/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  hanaFetch: vi.fn(),
  lookupModelMeta: vi.fn((_id: unknown, _provider?: unknown): unknown => null),
}));

vi.mock('../../../api', () => ({
  hanaFetch: (...args: unknown[]) => mocks.hanaFetch(...args),
}));

vi.mock('../../../../hooks/use-config', () => ({
  invalidateConfigCache: vi.fn(),
}));

vi.mock('../../../helpers', () => ({
  t: (key: string) => key,
  formatContext: (n: number) => `${n}`,
  lookupModelMeta: (id: unknown, provider?: unknown) => mocks.lookupModelMeta(id, provider),
}));

import { ProviderModelList } from '../ProviderModelList';

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

function rect(init: Partial<DOMRect>): DOMRect {
  return {
    x: init.left ?? 0,
    y: init.top ?? 0,
    left: init.left ?? 0,
    top: init.top ?? 0,
    right: init.right ?? (init.left ?? 0) + (init.width ?? 0),
    bottom: init.bottom ?? (init.top ?? 0) + (init.height ?? 0),
    width: init.width ?? 0,
    height: init.height ?? 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('ProviderModelList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hanaFetch.mockResolvedValue(jsonResponse({ models: [{ id: 'kimi-for-coding' }] }));
    mocks.lookupModelMeta.mockReturnValue(null);
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = '';
  });

  it('portals the add-model dropdown to body so fixed coordinates are viewport-relative', async () => {
    const onRefresh = vi.fn(async () => {});
    const { container } = render(
      <div data-testid="provider-host">
        <ProviderModelList
          providerId="kimi-coding"
          summary={{
            type: 'api-key',
            auth_type: 'api-key',
            display_name: 'Kimi Coding Plan',
            base_url: 'https://api.kimi.com/coding/',
            api: 'anthropic-messages',
            api_key: '',
            models: ['kimi-for-coding'],
            custom_models: [],
            has_credentials: false,
            supports_oauth: false,
            is_coding_plan: true,
            can_delete: false,
          }}
          onRefresh={onRefresh}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'settings.api.addModel' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect({
      left: 120,
      top: 300,
      bottom: 332,
      width: 240,
      height: 32,
    }));

    fireEvent.click(trigger);

    const panel = await waitFor(() => {
      const found = document.body.querySelector('[data-provider-model-dropdown="true"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    expect(container).not.toContainElement(panel);
    expect(panel).toHaveStyle({
      position: 'fixed',
      left: '120px',
      top: '336px',
      width: '320px',
    });
  });

  it('keeps the add-model dropdown open through the opening autofocus scroll', async () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);

    render(
      <ProviderModelList
        providerId="k+"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: 'K+',
          base_url: 'https://api.ticketpro.cc/v1',
          api: 'openai-responses',
          api_key: 'sk-test',
          models: [],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.api.addModel' }));
    expect(await screen.findByPlaceholderText('settings.api.searchModel')).toBeInTheDocument();

    now.mockReturnValue(1080);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.getByPlaceholderText('settings.api.searchModel')).toBeInTheDocument();

    now.mockReturnValue(1240);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByPlaceholderText('settings.api.searchModel')).not.toBeInTheDocument();
  });

  it('shows image, video, audio and reasoning capability icons after the added model id', () => {
    mocks.lookupModelMeta.mockImplementation((id: unknown, provider: unknown) => {
      if (id === 'doubao-seed-2-0-lite-260428' && provider === 'volcengine') {
        return {
          name: 'Doubao Seed 2.0 Lite',
          image: true,
          video: true,
          audio: true,
          reasoning: true,
          context: 256000,
        };
      }
      return null;
    });

    render(
      <ProviderModelList
        providerId="volcengine"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: 'Volcengine',
          base_url: 'https://ark.cn-beijing.volces.com/api/v3',
          api: 'openai-completions',
          api_key: 'sk-test',
          models: ['doubao-seed-2-0-lite-260428'],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    const id = screen.getByText('doubao-seed-2-0-lite-260428');
    expect(id.nextElementSibling).toHaveAttribute('title', 'settings.api.capability.image');
    expect(id.nextElementSibling?.nextElementSibling).toHaveAttribute('title', 'settings.api.capability.video');
    expect(id.nextElementSibling?.nextElementSibling?.nextElementSibling).toHaveAttribute('title', 'settings.api.capability.audio');
    expect(id.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling).toHaveAttribute('title', 'settings.api.capability.reasoning');
  });

  it('persists discovered relay model context when adding a model', async () => {
    const onRefresh = vi.fn(async () => {});
    mocks.hanaFetch.mockImplementation(async (url: unknown, opts?: unknown) => {
      if (String(url).includes('/discovered-models')) {
        return jsonResponse({
          models: [
            { id: 'gpt-5.5', name: 'GPT-5.5 Relay', context: 262144, maxOutput: 128000 },
          ],
        });
      }
      return jsonResponse({ ok: true });
    });

    render(
      <ProviderModelList
        providerId="k+"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: 'K+ Relay',
          base_url: 'https://api.ticketpro.cc/v1',
          api: 'openai-responses',
          api_key: 'sk-test',
          models: [],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.api.addModel' }));
    const option = await screen.findByText('gpt-5.5');
    fireEvent.click(option.closest('button') as HTMLButtonElement);

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    const saveCall = mocks.hanaFetch.mock.calls.find(([url]) => url === '/api/config');
    expect(saveCall).toBeTruthy();
    const body = JSON.parse((saveCall?.[1] as RequestInit).body as string);
    expect(body.providers['k+'].models).toEqual([
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5 Relay',
        context: 262144,
        maxOutput: 128000,
      },
    ]);
  });

  it('uses credential draft when fetching models and shows provider error details', async () => {
    mocks.hanaFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/discovered-models')) return jsonResponse({ models: [] });
      return jsonResponse({
        error: '账户余额不足，创建属于自己的工具，更多请访问 302.AI (code: -10004)',
        models: [],
      });
    });

    render(
      <ProviderModelList
        providerId="302.ai"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: '302.ai',
          base_url: 'https://api.openai.com',
          api: 'openai-completions',
          api_key: 'saved-key',
          models: [],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        credentialDraft={{
          base_url: 'https://api.302.ai/v1',
          api: 'openai-responses',
          api_key: 'draft-key',
        }}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.providers.fetchModels' }));

    await waitFor(() => {
      const call = mocks.hanaFetch.mock.calls.find(([url]) => url === '/api/providers/fetch-models');
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call?.[1] as RequestInit).body));
      expect(body).toMatchObject({
        name: '302.ai',
        base_url: 'https://api.302.ai/v1',
        api: 'openai-responses',
        api_key: 'draft-key',
      });
    });
    expect(await screen.findByText(/账户余额不足/)).toBeInTheDocument();
  });

  it('keeps the fetch button label stable, shows progress below it and keeps provider errors visible', async () => {
    vi.useFakeTimers();
    let resolveFetch: (value: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    mocks.hanaFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/discovered-models')) return jsonResponse({ models: [] });
      return pendingFetch;
    });

    render(
      <ProviderModelList
        providerId="302.ai"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: '302.ai',
          base_url: 'https://api.302.ai/v1',
          api: 'openai-completions',
          api_key: 'sk-test',
          models: [],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    const button = screen.getByRole('button', { name: 'settings.providers.fetchModels' });
    fireEvent.click(button);

    const busyButton = screen.getByRole('button', { name: 'settings.providers.fetchModels' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    expect(busyButton.className).toContain('_spinning_');
    expect(screen.getAllByText('settings.providers.fetchingModels')).toHaveLength(1);
    expect(screen.getByText('settings.providers.fetchingModels').className).toContain('_ok_');
    expect(screen.queryByText(/^settings\.providers\.fetchFailed/)).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(jsonResponse({
        error: '账户余额不足，创建属于自己的工具，更多请访问 302.AI (code: -10004)',
        models: [],
      }));
      await pendingFetch;
      await Promise.resolve();
    });

    expect(screen.getByText(/账户余额不足/)).toBeInTheDocument();
    expect(screen.getByText(/账户余额不足/).className).toContain('_fail_');
    expect(getComputedStyle(screen.getByText(/账户余额不足/)).animationName).not.toContain('hana-hint-fade');
    expect(screen.queryByText('settings.providers.fetchingModels')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.providers.fetchModels' })).not.toBeDisabled();
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText(/账户余额不足/)).toBeInTheDocument();
  });

  it('keeps a successful fetch result visible until the next fetch starts', async () => {
    vi.useFakeTimers();
    let resolveFetch: (value: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    mocks.hanaFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes('/discovered-models')) return jsonResponse({ models: [] });
      return pendingFetch;
    });

    render(
      <ProviderModelList
        providerId="302.ai"
        summary={{
          type: 'api-key',
          auth_type: 'api-key',
          display_name: '302.ai',
          base_url: 'https://api.302.ai/v1',
          api: 'openai-completions',
          api_key: 'sk-test',
          models: [],
          custom_models: [],
          has_credentials: true,
          supports_oauth: false,
          is_coding_plan: false,
          can_delete: true,
        }}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.providers.fetchModels' }));
    expect(screen.getByText('settings.providers.fetchingModels')).toBeInTheDocument();

    await act(async () => {
      resolveFetch(jsonResponse({ models: [{ id: 'gpt-test' }, { id: 'claude-test' }] }));
      await pendingFetch;
      await Promise.resolve();
    });

    const success = screen.getByText('settings.providers.fetchSuccess');
    expect(success).toBeInTheDocument();
    expect(success.className).toContain('_ok_');
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText('settings.providers.fetchSuccess')).toBeInTheDocument();
  });
});
