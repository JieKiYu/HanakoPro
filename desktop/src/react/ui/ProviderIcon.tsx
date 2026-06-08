import { PROVIDER_ICONS } from './provider-icons';
import groupStyles from './ProviderIcon.module.css';

const PROVIDER_TO_ICON: Record<string, string> = {
  deepseek: 'deepseek',
  dashscope: 'qwen',
  openai: 'openai',
  gemini: 'gemini',
  volcengine: 'volcengine',
  moonshot: 'moonshot',
  'kimi-coding': 'kimi',
  zhipu: 'zhipu',
  siliconflow: 'siliconcloud',
  groq: 'groq',
  mistral: 'mistral',
  minimax: 'minimax',
  'minimax-token-plan': 'minimax',
  openrouter: 'openrouter',
  mimo: 'xiaomimimo',
  'mimo-token-plan': 'xiaomimimo',
  ollama: 'ollama',
};

interface ProviderIconProps {
  provider?: string;
  className?: string;
}

function iconKeyFor(provider?: string): string | undefined {
  if (!provider) return undefined;
  const p = provider.toLowerCase();
  if (PROVIDER_TO_ICON[p]) return PROVIDER_TO_ICON[p];
  const base = p.replace(/-(coding-plan|coding|token-plan|oauth|codex-oauth|codex)$/, '');
  if (PROVIDER_TO_ICON[base]) return PROVIDER_TO_ICON[base];
  if (base.startsWith('openai')) return 'openai';
  return undefined;
}

export function ProviderIcon({ provider, className }: ProviderIconProps) {
  const iconKey = iconKeyFor(provider);
  const icon = iconKey ? PROVIDER_ICONS[iconKey] : undefined;

  if (!icon) {
    return (
      <svg
        className={className}
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox={icon.viewBox}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.content }}
    />
  );
}

export function ProviderGroupHeader({ provider }: { provider: string }) {
  return (
    <div className={groupStyles.groupHeader}>
      <ProviderIcon provider={provider} className={groupStyles.icon} />
      <span className={groupStyles.label}>{provider}</span>
    </div>
  );
}
