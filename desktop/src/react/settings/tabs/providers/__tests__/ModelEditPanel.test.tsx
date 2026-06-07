/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  lookupModelMeta: vi.fn((_id: unknown, _provider?: unknown): unknown => ({
    name: 'GPT-5.5 Relay',
    context: 262144,
    maxOutput: 128000,
  })),
  hanaFetch: vi.fn(async (_path?: unknown, _opts?: unknown) => ({ json: async () => ({ ok: true }) })),
}));

vi.mock('../../../helpers', () => ({
  t: (key: string) => key,
  lookupModelMeta: (id: unknown, provider?: unknown) => mocks.lookupModelMeta(id, provider),
  CONTEXT_PRESETS: [{ label: '256K', value: 262144 }],
  OUTPUT_PRESETS: [{ label: '128K', value: 128000 }],
}));

vi.mock('../../../api', () => ({
  hanaFetch: (path: unknown, opts?: unknown) => mocks.hanaFetch(path, opts),
}));

import { ModelEditPanel } from '../ModelEditPanel';

describe('ModelEditPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('looks up model metadata by provider and model id', () => {
    render(
      <ModelEditPanel
        modelId="gpt-5.5"
        providerId="k+"
        anchorEl={null}
        onClose={vi.fn()}
      />,
    );

    expect(mocks.lookupModelMeta).toHaveBeenCalledWith('gpt-5.5', 'k+');
    expect(screen.getByDisplayValue('GPT-5.5 Relay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('262144')).toBeInTheDocument();
  });
});
