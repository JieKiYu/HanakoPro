// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_NO_PAPER_TEXTURE_CLASS,
  MARKDOWN_CODE_STYLE_STORAGE_KEY,
  PAPER_TEXTURE_CLASS,
  PAPER_TEXTURE_STORAGE_KEY,
  applyMarkdownCodeStylePreference,
  applyPaperTextureClass,
  isPaperTextureEnabled,
  loadPaperTexturePreference,
  readMarkdownCodeStylePreference,
  resetMarkdownCodeStylePreference,
  setMarkdownCodeStylePreference,
  setPaperTexturePreference,
} from '../../../shared/appearance-preferences';
import registry from '../../../shared/theme-registry.cjs';

const MO_BAI_THEME = Object.entries(registry.THEMES).find(([, entry]) => entry.i18nName === 'settings.appearance.moBai')?.[0]
  || registry.DEFAULT_THEME;

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('paper texture preferences', () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
    document.body.className = '';
  });

  it('defaults to disabled and removes the legacy disable class', () => {
    document.body.classList.add(LEGACY_NO_PAPER_TEXTURE_CLASS);

    const enabled = loadPaperTexturePreference(storage, document.body);

    expect(enabled).toBe(false);
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(false);
    expect(document.body.classList.contains(LEGACY_NO_PAPER_TEXTURE_CLASS)).toBe(false);
  });

  it('enables texture only when the stored preference is explicit', () => {
    storage.setItem(PAPER_TEXTURE_STORAGE_KEY, '1');

    expect(isPaperTextureEnabled(storage)).toBe(true);
    expect(loadPaperTexturePreference(storage, document.body)).toBe(true);
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(true);
  });

  it('persists off as an explicit disabled state', () => {
    setPaperTexturePreference(true, storage, document.body);
    setPaperTexturePreference(false, storage, document.body);

    expect(storage.getItem(PAPER_TEXTURE_STORAGE_KEY)).toBe('0');
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(false);
  });

  it('never leaves the legacy inverted class behind', () => {
    document.body.classList.add(LEGACY_NO_PAPER_TEXTURE_CLASS);

    applyPaperTextureClass(true, document.body);

    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(true);
    expect(document.body.classList.contains(LEGACY_NO_PAPER_TEXTURE_CLASS)).toBe(false);
  });

  it('keeps the stored preference but suppresses texture in dark themes', () => {
    setPaperTexturePreference(true, storage, document.body, registry.AUTO_DARK_DEFAULT);

    expect(storage.getItem(PAPER_TEXTURE_STORAGE_KEY)).toBe('1');
    expect(isPaperTextureEnabled(storage)).toBe(true);
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(false);
  });

  it('restores texture automatically when a stored preference returns to a supported theme', () => {
    storage.setItem(PAPER_TEXTURE_STORAGE_KEY, '1');
    const blockedTheme = registry.PAPER_TEXTURE_BLOCKED_THEME_IDS[0];

    expect(blockedTheme).toBe(registry.AUTO_DARK_DEFAULT);
    expect(loadPaperTexturePreference(storage, document.body, blockedTheme)).toBe(true);
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(false);

    expect(loadPaperTexturePreference(storage, document.body, registry.AUTO_LIGHT_DEFAULT)).toBe(true);
    expect(document.body.classList.contains(PAPER_TEXTURE_CLASS)).toBe(true);
  });
});

describe('markdown code style preferences', () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
    document.documentElement.removeAttribute('style');
  });

  it('defaults to the theme-native code style when no override is stored', () => {
    expect(readMarkdownCodeStylePreference(MO_BAI_THEME, storage)).toEqual({
      inline: 'default',
      strong: 'default',
    });

    applyMarkdownCodeStylePreference(MO_BAI_THEME, storage);

    expect(document.documentElement.style.getPropertyValue('--markdown-inline-code-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-table-head-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-strong-code-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-bold-text')).toBe('');
  });

  it('stores markdown code styles independently per theme', () => {
    setMarkdownCodeStylePreference({ inline: 'jade' }, MO_BAI_THEME, storage);
    setMarkdownCodeStylePreference({ strong: 'rose' }, registry.AUTO_DARK_DEFAULT, storage);

    expect(readMarkdownCodeStylePreference(MO_BAI_THEME, storage)).toEqual({
      inline: 'jade',
      strong: 'default',
    });
    expect(readMarkdownCodeStylePreference(registry.AUTO_DARK_DEFAULT, storage)).toEqual({
      inline: 'default',
      strong: 'rose',
    });

    const stored = JSON.parse(storage.getItem(MARKDOWN_CODE_STYLE_STORAGE_KEY) || '{}');
    expect(stored[MO_BAI_THEME]).toEqual({ inline: 'jade', strong: 'default' });
    expect(stored[registry.AUTO_DARK_DEFAULT]).toEqual({ inline: 'default', strong: 'rose' });
  });

  it('applies the selected palette and resets only the current theme', () => {
    setMarkdownCodeStylePreference({ inline: 'amber', strong: 'rose' }, MO_BAI_THEME, storage);

    expect(document.documentElement.style.getPropertyValue('--markdown-inline-code-bg')).toBe('rgba(var(--markdown-amber-rgb), 0.12)');
    expect(document.documentElement.style.getPropertyValue('--markdown-table-head-bg')).toBe('rgba(var(--markdown-amber-rgb), 0.095)');
    expect(document.documentElement.style.getPropertyValue('--markdown-strong-code-bg')).toBe('rgba(var(--danger-rgb), 0.15)');

    resetMarkdownCodeStylePreference(MO_BAI_THEME, storage);

    expect(readMarkdownCodeStylePreference(MO_BAI_THEME, storage)).toEqual({
      inline: 'default',
      strong: 'default',
    });
    expect(document.documentElement.style.getPropertyValue('--markdown-inline-code-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-table-head-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-strong-code-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--markdown-bold-text')).toBe('');
  });

  it('clears legacy bold text color overrides without preserving the old setting', () => {
    storage.setItem(MARKDOWN_CODE_STYLE_STORAGE_KEY, JSON.stringify({
      [MO_BAI_THEME]: { inline: 'jade', strong: 'rose', bold: 'amber' },
    }));
    document.documentElement.style.setProperty('--markdown-bold-text', 'var(--danger)');

    expect(readMarkdownCodeStylePreference(MO_BAI_THEME, storage)).toEqual({
      inline: 'jade',
      strong: 'rose',
    });

    applyMarkdownCodeStylePreference(MO_BAI_THEME, storage);

    expect(document.documentElement.style.getPropertyValue('--markdown-inline-code-bg')).toBe('rgba(var(--green-rgb), 0.105)');
    expect(document.documentElement.style.getPropertyValue('--markdown-table-head-bg')).toBe('rgba(var(--green-rgb), 0.085)');
    expect(document.documentElement.style.getPropertyValue('--markdown-strong-code-bg')).toBe('rgba(var(--danger-rgb), 0.15)');
    expect(document.documentElement.style.getPropertyValue('--markdown-bold-text')).toBe('');
  });
});
