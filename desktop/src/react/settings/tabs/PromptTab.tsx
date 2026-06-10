import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../store';
import { autoSaveConfig } from '../helpers';
import { hanaFetch } from '../api';
import { SettingsSection } from '../components/SettingsSection';
import { Toggle } from '../widgets/Toggle';
import { renderMarkdown } from '../../utils/markdown';
import styles from '../Settings.module.css';
import {
  DEFAULT_ORIGIN_CONDUCT_PROMPT,
  DEFAULT_ORIGIN_MOOD_PROMPT,
  DEFAULT_ORIGIN_ROOT_PROMPT,
  getOriginPromptModuleTemplates,
  normalizePromptComposerConfig,
} from '../../../../../shared/prompt-composer.js';

type PromptBlock = {
  id: string;
  title: string;
  content: string;
  enabled?: boolean;
};

type PromptBlockOverride = {
  id: string;
  content: string;
  enabled?: boolean;
};

type PromptRoute = {
  id: string;
  name: string;
  blockIds: string[];
  blockOverrides?: PromptBlockOverride[];
};

type ToolParameterOverride = {
  path: string;
  description: string;
};

type ToolOverride = {
  name: string;
  description?: string;
  enabled?: boolean;
  parameters: ToolParameterOverride[];
};

type PromptSimplePreset = {
  id: string;
  name: string;
  content: string;
};

type PromptOriginConfig = {
  root: string;
  mood: string;
  anchor: string;
  conduct: string;
  keepBlockIds: string[];
  includePersonality: boolean;
  includeMood: boolean;
};

type PromptComposerConfig = {
  enabled: boolean;
  mode: 'blocks' | 'simple' | 'origin';
  activeRouteId: string;
  activeSimplePresetId: string;
  simpleContent: string;
  simplePresets: PromptSimplePreset[];
  origin: PromptOriginConfig;
  blockOverrides: PromptBlockOverride[];
  blocks: PromptBlock[];
  routes: PromptRoute[];
  toolOverrides: ToolOverride[];
};

type ToolSource = {
  name: string;
  label: string;
  description: string;
  enabled?: boolean;
  parameters: Array<{ path: string; description: string }>;
};

type PromptComposerSource = {
  tools: ToolSource[];
};

type SystemPromptPreview = {
  markdown: string;
  content: string;
  cwd?: string;
  model?: { id?: string; provider?: string; name?: string } | null;
};

type PromptModuleKey = '核' | '形' | '时' | '忆' | '器' | '令' | '照' | '德';
type PromptPreviewMode = 'markdown' | 'plain';

type PromptModule = {
  key: PromptModuleKey;
  content: string;
};

const MODULE_ORDER: PromptModuleKey[] = ['核', '形', '时', '忆', '器', '令', '照', '德'];
const MODULE_HINTS: Record<PromptModuleKey, string> = {
  核: '根本原则与核心文本',
  形: 'Hana 的身份、人格与关系设定',
  时: '当前时间、工作目录、运行环境',
  忆: '用户档案、置顶记忆、召回记忆',
  器: '工具行法与可用技能',
  令: '当前会话追加规则',
  照: '内照与 mood',
  德: '行动约束、确认边界、验证与交付方式',
};

function normalizeDraft(value: unknown): PromptComposerConfig {
  const normalized = normalizePromptComposerConfig(value) as PromptComposerConfig;
  const raw = value && typeof value === 'object' ? value as Partial<PromptComposerConfig> : {};
  const rawOrigin = raw.origin && typeof raw.origin === 'object' ? raw.origin as Partial<PromptOriginConfig> : {};
  const rootExists = hasOwn(rawOrigin, 'root');
  const moodExists = hasOwn(rawOrigin, 'mood');
  const conductExists = hasOwn(rawOrigin, 'conduct');
  const conductText = conductExists ? String(rawOrigin.conduct ?? '') : DEFAULT_ORIGIN_CONDUCT_PROMPT;
  return {
    ...normalized,
    enabled: true,
    mode: 'origin',
    simpleContent: '',
    simplePresets: [],
    origin: {
      ...normalized.origin,
      root: rootExists ? String(rawOrigin.root ?? '') : DEFAULT_ORIGIN_ROOT_PROMPT,
      mood: moodExists ? String(rawOrigin.mood ?? '') : DEFAULT_ORIGIN_MOOD_PROMPT,
      conduct: conductText,
      anchor: '',
    },
  };
}

function hasOwn(value: object | undefined, key: string) {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function trimText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function displayOriginRoot(origin: PromptOriginConfig) {
  return origin.root;
}

function displayOriginMood(origin: PromptOriginConfig) {
  return origin.mood;
}

function displayOriginConduct(origin: PromptOriginConfig) {
  return origin.conduct;
}

function summarizeContent(content: string) {
  const line = content.replace(/\s+/g, ' ').trim();
  if (!line) return '';
  return line.length > 96 ? `${line.slice(0, 96)}…` : line;
}

function isEditableModuleKey(key: PromptModuleKey) {
  return key === '核' || key === '照' || key === '德';
}

function getEditableModuleContent(key: PromptModuleKey, origin: PromptOriginConfig) {
  if (key === '核') return displayOriginRoot(origin);
  if (key === '照') return displayOriginMood(origin);
  if (key === '德') return displayOriginConduct(origin);
  return '';
}

function formatErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function PromptTab() {
  const { settingsConfig, agentId } = useSettingsStore(
    useShallow(s => ({ settingsConfig: s.settingsConfig, agentId: s.getSettingsAgentId() }))
  );
  const showToast = useSettingsStore(s => s.showToast);
  const [draft, setDraft] = useState<PromptComposerConfig>(() => normalizeDraft(settingsConfig?.promptComposer));
  const [source, setSource] = useState<PromptComposerSource>({ tools: [] });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SystemPromptPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PromptPreviewMode>('markdown');
  const [moduleDialogKey, setModuleDialogKey] = useState<PromptModuleKey | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const migrationKeyRef = useRef<string | null>(null);

  const fallbackModules = useMemo(() => {
    const validKeys = new Set<PromptModuleKey>(MODULE_ORDER);
    return getOriginPromptModuleTemplates(draft)
      .filter((module): module is PromptModule => validKeys.has(module.key as PromptModuleKey))
      .map(module => ({ key: module.key as PromptModuleKey, content: module.content }));
  }, [draft]);
  const visibleModules = useMemo(() => {
    const modulesByKey = new Map<PromptModuleKey, PromptModule>();
    for (const module of fallbackModules) {
      modulesByKey.set(module.key, module);
    }
    return MODULE_ORDER
      .map(key => modulesByKey.get(key))
      .filter((module): module is PromptModule => !!module);
  }, [fallbackModules]);
  const activeModule = moduleDialogKey
    ? visibleModules.find(module => module.key === moduleDialogKey) || fallbackModules.find(module => module.key === moduleDialogKey) || null
    : null;

  const saveDraft = useCallback(async (nextDraft: PromptComposerConfig, options: { silent?: boolean } = {}) => {
    setSaving(true);
    try {
      await autoSaveConfig({ promptComposer: nextDraft }, options);
    } finally {
      setSaving(false);
    }
  }, []);

  const updateDraft = (patch: Partial<PromptComposerConfig>, options: { autosave?: boolean } = {}) => {
    const nextDraft = normalizeDraft({ ...draft, ...patch, enabled: true, mode: 'origin' });
    setDraft(nextDraft);
    if (options.autosave !== false) {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = window.setTimeout(() => {
        void saveDraft(nextDraft, { silent: true });
      }, 600);
    }
  };

  const updateOrigin = (patch: Partial<PromptOriginConfig>, options: { autosave?: boolean } = {}) => {
    updateDraft({
      origin: {
        ...draft.origin,
        ...patch,
      },
    }, { autosave: options.autosave });
  };

  const refreshSystemPromptPreview = useCallback(async (
    nextDraft: PromptComposerConfig,
    options: { open?: boolean; silent?: boolean } = {},
  ) => {
    if (!agentId) return;
    setPreviewLoading(true);
    if (!options.silent) setPreviewError(null);
    try {
      const { homeFolder } = useSettingsStore.getState();
      const res = await hanaFetch(`/api/agents/${agentId}/system-prompt-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptComposer: normalizeDraft(nextDraft),
          cwd: typeof homeFolder === 'string' ? homeFolder : (typeof settingsConfig?.last_cwd === 'string' ? settingsConfig.last_cwd : undefined),
          memoryEnabled: settingsConfig?.memory?.enabled !== false,
          includeRuntimeFoundation: true,
        }),
        timeout: 60_000,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const nextPreview = {
        markdown: typeof data.markdown === 'string' ? data.markdown : '',
        content: typeof data.content === 'string' ? data.content : '',
        cwd: typeof data.cwd === 'string' ? data.cwd : undefined,
        model: data.model || null,
      };
      setPreview(nextPreview);
      if (options.open) setPreviewOpen(true);
    } catch (err: unknown) {
      if (!options.silent) setPreviewError(formatErrorMessage(err, '加载完整提示词失败'));
    } finally {
      setPreviewLoading(false);
    }
  }, [agentId, settingsConfig?.last_cwd, settingsConfig?.memory?.enabled]);

  const getToolOverride = (name: string) => draft.toolOverrides.find(tool => tool.name === name);

  const setAndSaveDraft = (nextDraft: PromptComposerConfig) => {
    const normalized = normalizeDraft(nextDraft);
    setDraft(normalized);
    void saveDraft(normalized);
  };

  const saveCurrentDraft = () => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    void saveDraft(normalizeDraft(draft));
  };

  const updateToolOverride = (name: string, patch: Partial<ToolOverride>) => {
    const existing = getToolOverride(name);
    setAndSaveDraft({
      ...draft,
      toolOverrides: existing
        ? draft.toolOverrides.map(tool => tool.name === name ? { ...tool, ...patch } : tool)
        : [...draft.toolOverrides, { name, parameters: [], ...patch }],
    });
  };

  const updateToolDescription = (name: string, description: string) => {
    updateToolOverride(name, { description });
  };

  const updateToolEnabled = (name: string, enabled: boolean) => {
    updateToolOverride(name, { enabled });
  };

  const updateToolParameter = (name: string, path: string, description: string) => {
    const existing = getToolOverride(name);
    const parameters = existing?.parameters || [];
    const nextParameters = parameters.some(param => param.path === path)
      ? parameters.map(param => param.path === path ? { ...param, description } : param)
      : [...parameters, { path, description }];
    updateToolOverride(name, { parameters: nextParameters });
  };

  const resetToolDescription = (name: string) => {
    const existing = getToolOverride(name);
    if (!existing) return;
    const rest = { ...existing };
    delete rest.description;
    if (rest.parameters.length === 0 && rest.enabled !== false) {
      setAndSaveDraft({ ...draft, toolOverrides: draft.toolOverrides.filter(tool => tool.name !== name) });
      return;
    }
    updateToolOverride(name, rest);
  };

  const resetToolParameter = (name: string, path: string) => {
    const existing = getToolOverride(name);
    if (!existing) return;
    const parameters = existing.parameters.filter(param => param.path !== path);
    if (!hasOwn(existing, 'description') && parameters.length === 0 && existing.enabled !== false) {
      setAndSaveDraft({ ...draft, toolOverrides: draft.toolOverrides.filter(tool => tool.name !== name) });
      return;
    }
    updateToolOverride(name, { parameters });
  };

  const resetModule = (key: PromptModuleKey) => {
    if (key === '核') {
      updateOrigin({ root: DEFAULT_ORIGIN_ROOT_PROMPT });
    }
    if (key === '照') {
      updateOrigin({ mood: DEFAULT_ORIGIN_MOOD_PROMPT });
    }
    if (key === '德') {
      updateOrigin({ conduct: DEFAULT_ORIGIN_CONDUCT_PROMPT, anchor: '' });
    }
  };

  const openModuleDialog = (module: PromptModule) => {
    setModuleDialogKey(module.key);
  };

  const renderModuleDialogBody = (module: PromptModule) => {
    if (!isEditableModuleKey(module.key)) {
      return (
        <div className={styles['prompt-preview-body']}>
          <pre className={styles['prompt-preview-raw']}>{module.content}</pre>
        </div>
      );
    }
    const editorValue = getEditableModuleContent(module.key, draft.origin);

    return (
      <div className={styles['prompt-dao-editor-body']}>
        {module.key === '照' && (
          <div className={styles['prompt-dao-editor-option']}>
            <div>
              <strong>外显内照</strong>
              <span>开启后在回复前显示一小段 mood；它只是一瞬气象，不替代事实、工具和行动。</span>
            </div>
            <Toggle on={draft.origin.includeMood === true} onChange={(enabled) => updateOrigin({ includeMood: enabled })} />
          </div>
        )}
        <textarea
          className={`${styles['settings-textarea']} ${styles['prompt-dao-editor-textarea']}`}
          aria-label={`${module.key}内容`}
          value={editorValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (module.key === '核') updateOrigin({ root: nextValue });
            if (module.key === '照') updateOrigin({ mood: nextValue });
            if (module.key === '德') updateOrigin({ conduct: nextValue, anchor: '' });
          }}
          spellCheck={false}
          autoFocus
        />
      </div>
    );
  };

  const renderCompletePreviewBody = () => {
    const rawText = preview?.content || preview?.markdown || '';
    if (previewMode === 'plain') {
      return <pre className={styles['prompt-preview-raw']}>{rawText}</pre>;
    }
    return (
      <div
        className={styles['prompt-preview-markdown']}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(preview?.markdown || rawText) }}
      />
    );
  };

  useEffect(() => {
    setDraft(normalizeDraft(settingsConfig?.promptComposer));
  }, [settingsConfig?.promptComposer]);

  useEffect(() => {
    const rawConfig = settingsConfig?.promptComposer as Partial<PromptComposerConfig> | undefined;
    const rawOrigin = rawConfig?.origin;
    if (!rawConfig || !rawOrigin) return;
    const hasLegacySimpleSource = !!trimText(rawConfig.simpleContent)
      || (Array.isArray(rawConfig.simplePresets) && rawConfig.simplePresets.length > 0);
    if (!hasLegacySimpleSource) return;

    const migrationKey = JSON.stringify({
      root: rawOrigin.root || '',
      mood: rawOrigin.mood || '',
      conduct: rawOrigin.conduct || '',
      anchor: rawOrigin.anchor || '',
      simpleContent: rawConfig.simpleContent || '',
      simplePresets: rawConfig.simplePresets || [],
    });
    if (migrationKeyRef.current === migrationKey) return;
    migrationKeyRef.current = migrationKey;
    void saveDraft(draft, { silent: true });
  }, [draft, saveDraft, settingsConfig?.promptComposer]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  useEffect(() => {
    if (!agentId) return;
    const ac = new AbortController();
    setSourceLoading(true);
    hanaFetch(`/api/agents/${agentId}/prompt-composer-source`, { signal: ac.signal })
      .then(res => res.json())
      .then(data => {
        if (ac.signal.aborted) return;
        if (data.error) throw new Error(data.error);
        setSource({
          tools: Array.isArray(data.tools) ? data.tools : [],
        });
      })
      .catch((err) => {
        if (!ac.signal.aborted) showToast(`加载提示词来源失败: ${err.message}`, 'error');
      })
      .finally(() => {
        if (!ac.signal.aborted) setSourceLoading(false);
      });
    return () => ac.abort();
  }, [agentId, showToast]);

  useEffect(() => {
    if (!agentId || !previewOpen) return;
    void refreshSystemPromptPreview(draft, { silent: true });
  }, [agentId, draft, previewOpen, refreshSystemPromptPreview]);

  return (
    <div className={`${styles['settings-tab-content']} ${styles['active']}`} data-tab="prompt">
      <SettingsSection>
        <div className={styles['prompt-dao-hero']}>
          <div>
            <h2>提示词</h2>
            <p>模块保留模板变量；完整提示词展示运行时展开后的真实内容。</p>
          </div>
          <button
            type="button"
            className={styles['settings-save-btn-sm']}
            disabled={previewLoading}
            onClick={() => void refreshSystemPromptPreview(draft, { open: true })}
          >
            {previewLoading ? '生成中…' : '查看完整提示词'}
          </button>
        </div>
        {previewError && <div className={styles['prompt-preview-error']}>{previewError}</div>}
      </SettingsSection>

      <div className={styles['prompt-dao-chain']}>
        {visibleModules.map((module) => (
          <article
            key={module.key}
            className={`${styles['prompt-dao-module']} ${module.key === '核' || module.key === '德' ? styles['prompt-dao-module-primary'] : ''}`}
          >
            <button
              type="button"
              className={styles['prompt-dao-module-summary']}
              onClick={() => openModuleDialog(module)}
              aria-label={`${isEditableModuleKey(module.key) ? '编辑' : '查看'} ${module.key}`}
            >
              <span className={styles['prompt-dao-glyph']}>{module.key}</span>
              <span className={styles['prompt-dao-module-copy']}>
                <span className={styles['prompt-dao-module-title']}>{MODULE_HINTS[module.key]}</span>
                <em>{summarizeContent(module.content)}</em>
              </span>
              <span className={styles['prompt-dao-module-state']}>
                {isEditableModuleKey(module.key) ? (saving ? '保存中' : '编辑') : '查看'}
              </span>
            </button>
          </article>
        ))}
      </div>

      <SettingsSection title="高级">
        <details className={styles['prompt-tools-panel']}>
          <summary className={styles['prompt-tools-summary']}>
            <span>工具描述覆盖</span>
            <span>{sourceLoading ? '正在加载…' : `${source.tools.length} 个工具`}</span>
          </summary>
          <SettingsSection.Note>这里调整工具清单里的说明，不混入完整提示词正文。</SettingsSection.Note>
          <div className={styles['prompt-editor-list']}>
            {source.tools.map(tool => {
              const override = getToolOverride(tool.name);
              const toolDescription = override && hasOwn(override, 'description') ? (override.description || '') : tool.description;
              const toolEnabled = tool.enabled !== false && (!override || override.enabled !== false);
              return (
                <details className={`${styles['prompt-editor-card']}${!toolEnabled ? ` ${styles['prompt-tool-disabled']}` : ''}`} key={tool.name} data-tool-enabled={toolEnabled ? '' : 'false'}>
                  <summary className={styles['prompt-editor-header']}>
                    <strong>{tool.name}</strong>
                    <div className={styles['prompt-tool-actions']}>
                      <Toggle on={toolEnabled} onChange={(v) => updateToolEnabled(tool.name, v)} />
                      <button type="button" className={`${styles['settings-save-btn-sm']} ${styles['prompt-header-action']}`} onClick={(event) => {
                        event.preventDefault();
                        resetToolDescription(tool.name);
                      }} disabled={!override || !hasOwn(override, 'description')}>恢复工具描述</button>
                    </div>
                  </summary>
                  <textarea
                    className={`${styles['settings-textarea']} ${styles['prompt-route-textarea']}`}
                    value={toolDescription}
                    onChange={(event) => updateToolDescription(tool.name, event.target.value)}
                    spellCheck={false}
                  />
                  {tool.parameters.map(param => {
                    const paramOverride = override?.parameters.find(item => item.path === param.path);
                    const paramDescription = paramOverride ? paramOverride.description : param.description;
                    return (
                      <div className={styles['prompt-editor-card']} key={param.path}>
                        <div className={styles['prompt-editor-header']}>
                          <code className={styles['prompt-id']}>{param.path}</code>
                          <button type="button" className={`${styles['settings-save-btn-sm']} ${styles['prompt-header-action']}`} onClick={() => resetToolParameter(tool.name, param.path)} disabled={!paramOverride}>恢复参数描述</button>
                        </div>
                        <textarea
                          className={`${styles['settings-textarea']} ${styles['prompt-route-textarea']}`}
                          value={paramDescription}
                          onChange={(event) => updateToolParameter(tool.name, param.path, event.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    );
                  })}
                </details>
              );
            })}
          </div>
        </details>
      </SettingsSection>

      {previewOpen && preview && createPortal(
        <div
          className={styles['prompt-preview-backdrop']}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <div className={styles['prompt-preview-dialog']} role="dialog" aria-modal="true" aria-label="完整提示词">
            <div className={styles['prompt-preview-header']}>
              <div>
                <h3>完整提示词</h3>
                <span>运行时展开</span>
              </div>
              <div className={styles['prompt-preview-actions']}>
                {(['markdown', 'plain'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles['prompt-preview-mode-toggle']} ${previewMode === mode ? styles['prompt-preview-mode-toggle-active'] : ''}`}
                    aria-pressed={previewMode === mode}
                    onClick={() => setPreviewMode(mode)}
                  >
                    {mode === 'markdown' ? 'Markdown' : '纯文本'}
                  </button>
                ))}
                <button type="button" className={styles['prompt-preview-close']} onClick={() => setPreviewOpen(false)}>×</button>
              </div>
            </div>
            <div className={styles['prompt-preview-body']}>
              {renderCompletePreviewBody()}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {activeModule && createPortal(
        <div
          className={styles['prompt-preview-backdrop']}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModuleDialogKey(null);
          }}
        >
          <div className={`${styles['prompt-preview-dialog']} ${styles['prompt-dao-editor-dialog']}`} role="dialog" aria-modal="true" aria-label={`${activeModule.key} ${MODULE_HINTS[activeModule.key]}`}>
            <div className={styles['prompt-preview-header']}>
              <div>
                <h3>{activeModule.key} · {MODULE_HINTS[activeModule.key]}</h3>
                <span>{isEditableModuleKey(activeModule.key) ? '可编辑模块' : '模块模板，只读'}</span>
              </div>
              <div className={styles['prompt-preview-actions']}>
                {isEditableModuleKey(activeModule.key) && (
                  <>
                    <button type="button" className={styles['settings-save-btn-sm']} onClick={saveCurrentDraft} disabled={saving}>
                      {saving ? '保存中…' : '保存'}
                    </button>
                    <button type="button" className={styles['settings-save-btn-sm']} onClick={() => resetModule(activeModule.key)}>恢复默认</button>
                  </>
                )}
                <button type="button" className={styles['prompt-preview-close']} onClick={() => setModuleDialogKey(null)}>×</button>
              </div>
            </div>
            {renderModuleDialogBody(activeModule)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
