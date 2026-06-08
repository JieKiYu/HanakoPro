// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterfaceTab } from '../InterfaceTab';
import { useSettingsStore } from '../../store';
import registry from '../../../../shared/theme-registry';
import { MARKDOWN_CODE_STYLE_STORAGE_KEY } from '../../../../shared/appearance-preferences';

const MO_BAI_THEME = Object.entries(registry.THEMES).find(([, entry]) => entry.i18nName === 'settings.appearance.moBai')?.[0]
  || registry.DEFAULT_THEME;

type AppearanceGlobals = typeof globalThis & {
  setTheme?: (theme: string) => void;
  setSerifFont?: (enabled: boolean) => void;
  setPaperTexture?: (enabled: boolean) => void;
};

function makeStorage(): Storage {
  let data: Record<string, string> = {};
  return {
    get length() { return Object.keys(data).length; },
    clear: vi.fn(() => { data = {}; }),
    getItem: vi.fn((key: string) => data[key] ?? null),
    key: vi.fn((index: number) => Object.keys(data)[index] ?? null),
    removeItem: vi.fn((key: string) => { delete data[key]; }),
    setItem: vi.fn((key: string, value: string) => { data[key] = String(value); }),
  };
}

function setAppearanceGlobals() {
  (globalThis as AppearanceGlobals).setTheme = vi.fn((theme: string) => {
    localStorage.setItem('hana-theme', theme);
    document.documentElement.setAttribute('data-theme', theme === 'auto' ? registry.DEFAULT_THEME : theme);
  });
  (globalThis as AppearanceGlobals).setSerifFont = vi.fn((enabled: boolean) => {
    localStorage.setItem('hana-font-serif', enabled ? '1' : '0');
    document.body.classList.toggle('font-sans', !enabled);
  });
  (globalThis as AppearanceGlobals).setPaperTexture = vi.fn((enabled: boolean) => {
    localStorage.setItem('hana-paper-texture', enabled ? '1' : '0');
  });
}

function seedSettings() {
  useSettingsStore.setState({
    settingsConfig: {
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      editor: {},
    },
    currentAgentId: 'agent-1',
    settingsAgentId: 'agent-1',
  } as never);
}

describe('InterfaceTab appearance state', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    const storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    localStorage.clear();
    document.body.className = '';
    document.documentElement.setAttribute('data-theme', registry.DEFAULT_THEME);
    window.t = ((key: string) => key) as typeof window.t;
    window.platform = {
      settingsChanged: vi.fn(),
    } as unknown as typeof window.platform;
    setAppearanceGlobals();
    seedSettings();
  });

  it('updates the serif font toggle from component state after the preference changes', () => {
    localStorage.setItem('hana-font-serif', '1');

    render(React.createElement(InterfaceTab));

    expect(screen.getAllByRole('switch')[0].getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getAllByRole('switch')[0]);

    expect(screen.getAllByRole('switch')[0].getAttribute('aria-checked')).toBe('false');
  });

  it('recomputes paper texture availability when the selected theme changes', () => {
    localStorage.setItem('hana-theme', registry.DEFAULT_THEME);
    localStorage.setItem('hana-paper-texture', '1');

    render(React.createElement(InterfaceTab));

    const paperSwitch = () => screen.getAllByRole('switch')[1] as HTMLButtonElement;
    expect(paperSwitch().getAttribute('aria-checked')).toBe('true');
    expect(paperSwitch().disabled).toBe(false);

    const midnightTheme = screen.getByText('settings.appearance.midnight').closest('button');
    expect(midnightTheme).toBeTruthy();
    fireEvent.click(midnightTheme!);

    expect(paperSwitch().getAttribute('aria-checked')).toBe('false');
    expect(paperSwitch().disabled).toBe(true);
  });

  it('saves markdown code style presets for the current concrete theme', () => {
    document.documentElement.setAttribute('data-theme', MO_BAI_THEME);
    localStorage.setItem('hana-theme', MO_BAI_THEME);

    render(React.createElement(InterfaceTab));

    fireEvent.click(screen.getAllByTitle('settings.appearance.markdownCodeStyle.default')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.appearance.markdownCodeStyle.jade' }));

    fireEvent.click(screen.getAllByTitle('settings.appearance.markdownCodeStyle.default')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.appearance.markdownCodeStyle.rose' }));

    const stored = JSON.parse(localStorage.getItem(MARKDOWN_CODE_STYLE_STORAGE_KEY) || '{}');
    expect(stored[MO_BAI_THEME]).toEqual({ inline: 'jade', strong: 'rose' });
    expect(document.documentElement.style.getPropertyValue('--markdown-inline-code-bg')).toBe('rgba(var(--green-rgb), 0.105)');
    expect(document.documentElement.style.getPropertyValue('--markdown-table-head-bg')).toBe('rgba(var(--green-rgb), 0.085)');
    expect(document.documentElement.style.getPropertyValue('--markdown-strong-code-bg')).toBe('rgba(var(--danger-rgb), 0.15)');
    expect(document.documentElement.style.getPropertyValue('--markdown-bold-text')).toBe('');
  });

  it('switches markdown code style controls when theme changes and resets only that theme', () => {
    localStorage.setItem(MARKDOWN_CODE_STYLE_STORAGE_KEY, JSON.stringify({
      [MO_BAI_THEME]: { inline: 'jade', strong: 'rose', bold: 'amber' },
      [registry.AUTO_DARK_DEFAULT]: { inline: 'amber', strong: 'ink', bold: 'jade' },
    }));
    localStorage.setItem('hana-theme', MO_BAI_THEME);
    document.documentElement.setAttribute('data-theme', MO_BAI_THEME);

    render(React.createElement(InterfaceTab));

    expect(screen.getByTitle('settings.appearance.markdownCodeStyle.jade')).toBeTruthy();
    expect(screen.getByTitle('settings.appearance.markdownCodeStyle.rose')).toBeTruthy();

    const midnightTheme = screen.getByText('settings.appearance.midnight').closest('button');
    fireEvent.click(midnightTheme!);

    expect(screen.getByTitle('settings.appearance.markdownCodeStyle.amber')).toBeTruthy();
    expect(screen.getByTitle('settings.appearance.markdownCodeStyle.ink')).toBeTruthy();

    fireEvent.click(screen.getByText('settings.appearance.resetMarkdownCodeStyle'));

    const stored = JSON.parse(localStorage.getItem(MARKDOWN_CODE_STYLE_STORAGE_KEY) || '{}');
    expect(stored[MO_BAI_THEME]).toEqual({ inline: 'jade', strong: 'rose', bold: 'amber' });
    expect(stored[registry.AUTO_DARK_DEFAULT]).toBeUndefined();
    expect(screen.getAllByTitle('settings.appearance.markdownCodeStyle.default')).toHaveLength(2);
  });
});
