import registry from './theme-registry';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type PaperTextureTheme = string | null | undefined;
type StyleRoot = Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>;

export const PAPER_TEXTURE_STORAGE_KEY = 'hana-paper-texture';
export const PAPER_TEXTURE_CLASS = 'paper-texture';
export const LEGACY_NO_PAPER_TEXTURE_CLASS = 'no-paper-texture';
export const MARKDOWN_CODE_STYLE_STORAGE_KEY = 'hana-markdown-code-styles';

export const MARKDOWN_INLINE_CODE_STYLE_IDS = ['default', 'ink', 'jade', 'amber', 'rose'] as const;
export const MARKDOWN_STRONG_CODE_STYLE_IDS = ['default', 'ink', 'jade', 'amber', 'rose'] as const;

export type MarkdownInlineCodeStyleId = typeof MARKDOWN_INLINE_CODE_STYLE_IDS[number];
export type MarkdownStrongCodeStyleId = typeof MARKDOWN_STRONG_CODE_STYLE_IDS[number];

export interface MarkdownCodeStylePreference {
  inline: MarkdownInlineCodeStyleId;
  strong: MarkdownStrongCodeStyleId;
}

type MarkdownCodeStyleStore = Record<string, Partial<MarkdownCodeStylePreference> | undefined>;

type MarkdownCodeStylePalette = Partial<Record<
  '--markdown-inline-code-text'
  | '--markdown-inline-code-bg'
  | '--markdown-inline-code-border'
  | '--markdown-table-head-bg'
  | '--markdown-strong-code-text'
  | '--markdown-strong-code-bg'
  | '--markdown-strong-code-border'
  | '--markdown-bold-text',
  string
>>;

const MARKDOWN_CODE_STYLE_PROPERTIES = [
  '--markdown-inline-code-text',
  '--markdown-inline-code-bg',
  '--markdown-inline-code-border',
  '--markdown-table-head-bg',
  '--markdown-strong-code-text',
  '--markdown-strong-code-bg',
  '--markdown-strong-code-border',
  // Legacy custom bold text color variable; keep clearing it after removing the setting.
  '--markdown-bold-text',
] as const;

const DEFAULT_MARKDOWN_CODE_STYLE: MarkdownCodeStylePreference = {
  inline: 'default',
  strong: 'default',
};

const INLINE_CODE_STYLE_PALETTES: Record<MarkdownInlineCodeStyleId, MarkdownCodeStylePalette> = {
  default: {},
  ink: {
    '--markdown-inline-code-text': 'var(--text)',
    '--markdown-inline-code-bg': 'color-mix(in srgb, var(--text) 7%, transparent)',
    '--markdown-inline-code-border': 'color-mix(in srgb, var(--text) 13%, transparent)',
    '--markdown-table-head-bg': 'color-mix(in srgb, var(--text) 5.5%, transparent)',
  },
  jade: {
    '--markdown-inline-code-text': 'var(--green)',
    '--markdown-inline-code-bg': 'rgba(var(--green-rgb), 0.105)',
    '--markdown-inline-code-border': 'rgba(var(--green-rgb), 0.22)',
    '--markdown-table-head-bg': 'rgba(var(--green-rgb), 0.085)',
  },
  amber: {
    '--markdown-inline-code-text': 'var(--markdown-amber-text)',
    '--markdown-inline-code-bg': 'rgba(var(--markdown-amber-rgb), 0.12)',
    '--markdown-inline-code-border': 'rgba(var(--markdown-amber-rgb), 0.25)',
    '--markdown-table-head-bg': 'rgba(var(--markdown-amber-rgb), 0.095)',
  },
  rose: {
    '--markdown-inline-code-text': 'var(--danger)',
    '--markdown-inline-code-bg': 'rgba(var(--danger-rgb), 0.095)',
    '--markdown-inline-code-border': 'rgba(var(--danger-rgb), 0.21)',
    '--markdown-table-head-bg': 'rgba(var(--danger-rgb), 0.078)',
  },
};

const STRONG_CODE_STYLE_PALETTES: Record<MarkdownStrongCodeStyleId, MarkdownCodeStylePalette> = {
  default: {},
  ink: {
    '--markdown-strong-code-text': 'var(--text)',
    '--markdown-strong-code-bg': 'color-mix(in srgb, var(--text) 11%, transparent)',
    '--markdown-strong-code-border': 'color-mix(in srgb, var(--text) 19%, transparent)',
  },
  jade: {
    '--markdown-strong-code-text': 'var(--green)',
    '--markdown-strong-code-bg': 'rgba(var(--green-rgb), 0.16)',
    '--markdown-strong-code-border': 'rgba(var(--green-rgb), 0.34)',
  },
  amber: {
    '--markdown-strong-code-text': 'var(--markdown-amber-text)',
    '--markdown-strong-code-bg': 'rgba(var(--markdown-amber-rgb), 0.18)',
    '--markdown-strong-code-border': 'rgba(var(--markdown-amber-rgb), 0.38)',
  },
  rose: {
    '--markdown-strong-code-text': 'var(--danger)',
    '--markdown-strong-code-bg': 'rgba(var(--danger-rgb), 0.15)',
    '--markdown-strong-code-border': 'rgba(var(--danger-rgb), 0.32)',
  },
};

function getCurrentTheme(): string | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.getAttribute('data-theme');
}

function isInlineCodeStyleId(value: unknown): value is MarkdownInlineCodeStyleId {
  return typeof value === 'string' && MARKDOWN_INLINE_CODE_STYLE_IDS.includes(value as MarkdownInlineCodeStyleId);
}

function isStrongCodeStyleId(value: unknown): value is MarkdownStrongCodeStyleId {
  return typeof value === 'string' && MARKDOWN_STRONG_CODE_STYLE_IDS.includes(value as MarkdownStrongCodeStyleId);
}

function getMarkdownStyleRoot(root?: StyleRoot): StyleRoot {
  if (root) return root;
  return document.documentElement.style;
}

function readMarkdownCodeStyleStore(storage: PreferenceStorage): MarkdownCodeStyleStore {
  const raw = storage.getItem(MARKDOWN_CODE_STYLE_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as MarkdownCodeStyleStore;
  } catch {
    return {};
  }
}

function normalizeMarkdownCodeStylePreference(value: unknown): MarkdownCodeStylePreference {
  const candidate = value && typeof value === 'object' ? value as Partial<MarkdownCodeStylePreference> : {};
  return {
    inline: isInlineCodeStyleId(candidate.inline) ? candidate.inline : DEFAULT_MARKDOWN_CODE_STYLE.inline,
    strong: isStrongCodeStyleId(candidate.strong) ? candidate.strong : DEFAULT_MARKDOWN_CODE_STYLE.strong,
  };
}

function writeMarkdownCodeStyleStore(storage: PreferenceStorage, store: MarkdownCodeStyleStore): void {
  storage.setItem(MARKDOWN_CODE_STYLE_STORAGE_KEY, JSON.stringify(store));
}

function applyMarkdownCodeStylePalette(style: StyleRoot, palette: MarkdownCodeStylePalette): void {
  for (const property of MARKDOWN_CODE_STYLE_PROPERTIES) {
    const value = palette[property];
    if (value) style.setProperty(property, value);
    else style.removeProperty(property);
  }
}

export function readMarkdownCodeStylePreference(
  theme: PaperTextureTheme = getCurrentTheme(),
  storage: PreferenceStorage = window.localStorage,
): MarkdownCodeStylePreference {
  const themeKey = theme || registry.DEFAULT_THEME;
  const store = readMarkdownCodeStyleStore(storage);
  return normalizeMarkdownCodeStylePreference(store[themeKey]);
}

export function applyMarkdownCodeStylePreference(
  theme: PaperTextureTheme = getCurrentTheme(),
  storage: PreferenceStorage = window.localStorage,
  root?: StyleRoot,
): MarkdownCodeStylePreference {
  const preference = readMarkdownCodeStylePreference(theme, storage);
  applyMarkdownCodeStylePalette(getMarkdownStyleRoot(root), {
    ...INLINE_CODE_STYLE_PALETTES[preference.inline],
    ...STRONG_CODE_STYLE_PALETTES[preference.strong],
  });
  return preference;
}

export function setMarkdownCodeStylePreference(
  patch: Partial<MarkdownCodeStylePreference>,
  theme: PaperTextureTheme = getCurrentTheme(),
  storage: PreferenceStorage = window.localStorage,
  root?: StyleRoot,
): MarkdownCodeStylePreference {
  const themeKey = theme || registry.DEFAULT_THEME;
  const store = readMarkdownCodeStyleStore(storage);
  const current = normalizeMarkdownCodeStylePreference(store[themeKey]);
  const next = normalizeMarkdownCodeStylePreference({ ...current, ...patch });
  store[themeKey] = next;
  writeMarkdownCodeStyleStore(storage, store);
  applyMarkdownCodeStylePreference(themeKey, storage, root);
  return next;
}

export function resetMarkdownCodeStylePreference(
  theme: PaperTextureTheme = getCurrentTheme(),
  storage: PreferenceStorage = window.localStorage,
  root?: StyleRoot,
): MarkdownCodeStylePreference {
  const themeKey = theme || registry.DEFAULT_THEME;
  const store = readMarkdownCodeStyleStore(storage);
  delete store[themeKey];
  writeMarkdownCodeStyleStore(storage, store);
  applyMarkdownCodeStylePreference(themeKey, storage, root);
  return DEFAULT_MARKDOWN_CODE_STYLE;
}

export function isPaperTextureEnabled(storage: PreferenceStorage = window.localStorage): boolean {
  return storage.getItem(PAPER_TEXTURE_STORAGE_KEY) === '1';
}

export function isPaperTextureBlockedTheme(theme: PaperTextureTheme = getCurrentTheme()): boolean {
  return registry.isPaperTextureBlockedTheme(theme);
}

export function isPaperTextureEffectivelyEnabled(
  enabled: boolean,
  theme: PaperTextureTheme = getCurrentTheme(),
): boolean {
  return enabled && !isPaperTextureBlockedTheme(theme);
}

export function applyPaperTextureClass(
  enabled: boolean,
  body: HTMLElement = document.body,
  theme: PaperTextureTheme = getCurrentTheme(),
): void {
  body.classList.toggle(PAPER_TEXTURE_CLASS, isPaperTextureEffectivelyEnabled(enabled, theme));
  body.classList.remove(LEGACY_NO_PAPER_TEXTURE_CLASS);
}

export function setPaperTexturePreference(
  enabled: boolean,
  storage: PreferenceStorage = window.localStorage,
  body: HTMLElement = document.body,
  theme: PaperTextureTheme = getCurrentTheme(),
): void {
  applyPaperTextureClass(enabled, body, theme);
  storage.setItem(PAPER_TEXTURE_STORAGE_KEY, enabled ? '1' : '0');
}

export function loadPaperTexturePreference(
  storage: PreferenceStorage = window.localStorage,
  body: HTMLElement = document.body,
  theme: PaperTextureTheme = getCurrentTheme(),
): boolean {
  const enabled = isPaperTextureEnabled(storage);
  applyPaperTextureClass(enabled, body, theme);
  return enabled;
}
