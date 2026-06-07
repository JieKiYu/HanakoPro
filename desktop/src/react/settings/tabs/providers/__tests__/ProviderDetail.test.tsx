/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ProviderSummary } from '../../../store';

const mocks = vi.hoisted(() => ({
  hanaFetch: vi.fn<(...args: unknown[]) => Promise<{ json: () => Promise<unknown> }>>(async () => ({ json: async () => ({ models: [] }) })),
}));

vi.mock('../../../helpers', () => ({
  t: (key: string) => key,
  formatContext: (n: number) => `${n}`,
  lookupModelMeta: () => null,
  API_FORMAT_OPTIONS: [
    { value: 'openai-responses', label: 'OpenAI Responses' },
  ],
}));

vi.mock('../../../api', () => ({
  hanaFetch: (...args: unknown[]) => mocks.hanaFetch(...args),
}));

vi.mock('../../../../hooks/use-config', () => ({
  invalidateConfigCache: vi.fn(),
}));

import { ProviderDetail } from '../ProviderDetail';

function providerSummary(overrides: Partial<ProviderSummary>): ProviderSummary {
  return {
    type: 'api-key',
    auth_type: 'api-key',
    display_name: 'ACUI',
    base_url: 'https://api.acui.shop',
    api: 'openai-responses',
    api_key: 'sk-test',
    models: [],
    custom_models: [],
    has_credentials: true,
    supports_oauth: false,
    can_delete: true,
    ...overrides,
  };
}

describe('ProviderDetail', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('does not show credential-incomplete alert when only models are missing', () => {
    render(
      <ProviderDetail
        providerId="acui"
        summary={providerSummary({
          config_status: 'needs_setup',
          missing_fields: ['models'],
        })}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.queryByText('settings.providers.configIncomplete')).not.toBeInTheDocument();
    expect(screen.getByText('settings.providers.modelsRequired')).toBeInTheDocument();
  });

  it('still shows credential-incomplete alert when API key or Base URL is missing', () => {
    render(
      <ProviderDetail
        providerId="acui"
        summary={providerSummary({
          api_key: '',
          has_credentials: false,
          config_status: 'needs_setup',
          missing_fields: ['api_key', 'models'],
        })}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText('settings.providers.configIncomplete')).toBeInTheDocument();
    expect(screen.getByText('settings.providers.modelsRequired')).toBeInTheDocument();
  });

  it('uses the current Base URL draft when fetching models before blur saves it', async () => {
    mocks.hanaFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/discovered-models')) return { json: async () => ({ models: [] }) };
      return { json: async () => ({ error: '账户余额不足', models: [] }) };
    });

    const { container } = render(
      <ProviderDetail
        providerId="302.ai"
        summary={providerSummary({
          display_name: '302.ai',
          base_url: 'https://api.openai.com',
          api: 'openai-completions',
          api_key: 'sk-302-test',
        })}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    const textInputs = container.querySelectorAll('input[type="text"]');
    const baseUrlInput = Array.from(textInputs).find(input => input.getAttribute('placeholder') === 'https://api.example.com/v1') as HTMLInputElement;
    fireEvent.change(baseUrlInput, { target: { value: 'https://api.302.ai/v1' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.providers.fetchModels' }));

    await waitFor(() => {
      const call = mocks.hanaFetch.mock.calls.find(([url]) => url === '/api/providers/fetch-models');
      expect(call).toBeTruthy();
      const options = call?.[1] as RequestInit | undefined;
      const body = JSON.parse(String(options?.body));
      expect(body.base_url).toBe('https://api.302.ai/v1');
      expect(body.base_url).not.toBe('https://api.openai.com');
    });
  });
});
