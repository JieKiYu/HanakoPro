// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptTab } from '../PromptTab';
import { useSettingsStore } from '../../store';
import { composeOriginPromptTemplate } from '../../../../../../shared/prompt-composer.js';

const legacyDaoPrompt = [
  '# 核',
  '',
  '所遵从之一切，均来自于下述帛书《老子》与道藏《阴符经》。',
  '',
  '---',
  '',
  '## 经',
  '',
  '### 帛书《老子》· 道经',
  '',
  '道经全文',
  '',
  '---',
  '',
  '## 二 · 运行之境',
  '',
  '运行时内容不属于核',
].join('\n');

const mocks = vi.hoisted(() => ({
  autoSaveConfig: vi.fn<(partial: unknown, options?: unknown) => Promise<boolean>>(async () => true),
  hanaFetch: vi.fn<(url: string, options?: unknown) => Promise<Response>>(),
}));

vi.mock('../../api', () => ({
  hanaFetch: (url: string, options?: unknown) => mocks.hanaFetch(url, options),
}));

vi.mock('../../helpers', () => ({
  autoSaveConfig: (partial: unknown, options?: unknown) => mocks.autoSaveConfig(partial, options),
}));

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

function readPromptComposer(options?: unknown) {
  if (!options || typeof options !== 'object' || !('body' in options)) return {};
  const body = (options as { body?: unknown }).body;
  if (typeof body !== 'string') return {};
  return JSON.parse(body).promptComposer || {};
}

function readPreviewBody(options?: unknown) {
  if (!options || typeof options !== 'object' || !('body' in options)) return {};
  const body = (options as { body?: unknown }).body;
  return typeof body === 'string' ? JSON.parse(body) : {};
}

function previewFromRequest(options?: unknown) {
  const body = readPreviewBody(options) as {
    templatePreview?: boolean;
    includeRuntimeFoundation?: boolean;
    promptComposer?: {
      origin?: {
        root?: string;
        mood?: string;
        conduct?: string;
        anchor?: string;
        includeMood?: boolean;
      };
    };
  };
  const promptComposer = body.promptComposer || {};
  if (body.templatePreview === true) {
    return composeOriginPromptTemplate(promptComposer) || '';
  }
  const runtimeFoundation = body.includeRuntimeFoundation === true
    ? [
      '器是 HanakoPro 的工具行法',
      '## 行 · 终端',
      '终端链路开始前只有在进入新阶段且确有助于理解时才给一句说明',
    ].join('\n\n')
    : '';
  const typedComposer = promptComposer as {
    origin?: {
      root?: string;
      mood?: string;
      conduct?: string;
      anchor?: string;
      includeMood?: boolean;
    };
  };
  const origin = typedComposer.origin || {};
  return [
    origin.root || '',
    compactSection('形', '身份设定'),
    compactSection('时', '当前环境'),
    compactSection('忆', '记忆事实'),
    compactSection('器', [runtimeFoundation, '可用技能'].filter(Boolean).join('\n\n')),
    compactSection('令', '追加规则'),
    ...(origin.includeMood === false ? [] : [origin.mood || '']),
    origin.conduct || '',
  ].filter(Boolean).join('\n\n---\n\n');
}

function compactSection(title: string, content: string) {
  const body = content.trim();
  return body ? `# ${title}\n\n${body}` : '';
}

function closeActiveModuleDialog() {
  const dialogs = screen.getAllByRole('dialog');
  const dialog = dialogs.at(-1);
  if (!dialog) throw new Error('expected dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '×' }));
}

function latestPreviewRequestText() {
  const previewCalls = mocks.hanaFetch.mock.calls.filter(([url]) => String(url).endsWith('/system-prompt-preview'));
  return previewFromRequest(previewCalls.at(-1)?.[1]);
}

function latestPreviewRequestComposer() {
  const previewCalls = mocks.hanaFetch.mock.calls.filter(([url]) => String(url).endsWith('/system-prompt-preview'));
  return readPromptComposer(previewCalls.at(-1)?.[1]) as {
    origin?: {
      root?: string;
      mood?: string;
      conduct?: string;
      anchor?: string;
      includeMood?: boolean;
    };
  };
}

function latestPreviewRequestBody() {
  const previewCalls = mocks.hanaFetch.mock.calls.filter(([url]) => String(url).endsWith('/system-prompt-preview'));
  return readPreviewBody(previewCalls.at(-1)?.[1]) as { includeRuntimeFoundation?: boolean; templatePreview?: boolean };
}

function latestSavedComposer() {
  const lastSaveCall = mocks.autoSaveConfig.mock.calls.at(-1);
  const savedPayload = lastSaveCall?.[0] as { promptComposer?: unknown } | undefined;
  return savedPayload?.promptComposer;
}

function seedSettings(promptComposer: Record<string, unknown> = {}) {
  useSettingsStore.setState({
    currentAgentId: 'agent-a',
    settingsAgentId: 'agent-a',
    homeFolder: '/Users/jieki/Projects/HanakoPro-mac',
    settingsConfig: {
      last_cwd: '/Users/jieki/Projects/HanakoPro-mac',
      memory: { enabled: true },
      promptComposer,
    },
    toastMessage: '',
    toastType: '',
    toastVisible: false,
  } as never);
}

describe('PromptTab dao prompt editor', () => {
  beforeEach(() => {
    cleanup();
    mocks.autoSaveConfig.mockClear();
    mocks.hanaFetch.mockReset();
    mocks.hanaFetch.mockImplementation(async (url: string, options?: unknown) => {
      if (url.endsWith('/prompt-composer-source')) {
        return jsonResponse({
          tools: [
            {
              name: 'web.run',
              label: 'Web',
              description: 'Search the web',
              enabled: true,
              parameters: [{ path: 'q', description: 'search query' }],
            },
          ],
        });
      }
      if (url.endsWith('/system-prompt-preview')) {
        return jsonResponse({
          markdown: '',
          content: previewFromRequest(options),
        });
      }
      return jsonResponse({});
    });
    seedSettings();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the module chain as variable templates before the full preview returns', () => {
    seedSettings({
      mode: 'origin',
      origin: {
        root: '# 核\n\n初始核',
        mood: '# 照\n\n初始照',
        conduct: '# 德\n\n初始德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    expect(screen.getByRole('button', { name: '编辑 核' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑 照' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑 德' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '查看 形' })).toHaveTextContent('{{originPersonality}}');
    expect(screen.getByRole('button', { name: '查看 时' })).toHaveTextContent('{{workspace}}');
    expect(screen.getByRole('button', { name: '查看 忆' })).toHaveTextContent('{{userProfile}}');
    expect(screen.getByRole('button', { name: '查看 器' })).toHaveTextContent('{{skills}}');
    expect(screen.getByRole('button', { name: '查看 令' })).toHaveTextContent('{{appendSystemPrompt}}');

    const previewCalls = mocks.hanaFetch.mock.calls.filter(([url]) => String(url).endsWith('/system-prompt-preview'));
    expect(previewCalls).toHaveLength(0);
  });

  it('renders the final-prompt module chain without old template mode controls', async () => {
    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));

    await waitFor(() => {
      expect(mocks.hanaFetch).toHaveBeenCalledWith(
        '/api/agents/agent-a/system-prompt-preview',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const bodyText = document.body.textContent || '';
    expect(bodyText).toContain('模块保留模板变量');
    for (const moduleKey of ['核', '形', '时', '忆', '器', '令', '照', '德']) {
      expect(bodyText).toContain(moduleKey);
    }
    expect(screen.getByRole('button', { name: '查看 形' })).toHaveTextContent('{{originPersonality}}');
    expect(screen.getByRole('button', { name: '查看 时' })).toHaveTextContent('{{workspace}}');
    expect(screen.getByRole('button', { name: '查看 忆' })).toHaveTextContent('{{userProfile}}');
    expect(screen.getByRole('button', { name: '查看 器' })).toHaveTextContent('{{skills}}');
    expect(screen.getByRole('button', { name: '查看 令' })).toHaveTextContent('{{appendSystemPrompt}}');
    expect(bodyText).toContain('工具描述覆盖');
    expect(bodyText).toContain('1 个工具');

    for (const retiredLabel of [
      '完整模板',
      '普通模式',
      '组合模式',
      'system.content',
      '当前模板',
      '新建模板',
      '复制当前',
      '删除自定义',
      '原文切换',
      '保存状态',
      '镜:',
    ]) {
      expect(bodyText).not.toContain(retiredLabel);
    }

    const preview = await screen.findByRole('dialog', { name: '完整提示词' });
    expect(within(preview).getByText('运行时展开')).toBeInTheDocument();
    expect(latestPreviewRequestBody().includeRuntimeFoundation).toBe(true);
    expect(latestPreviewRequestBody().templatePreview).not.toBe(true);
    expect(preview.textContent || '').toContain('器是 HanakoPro 的工具行法');
    expect(preview.textContent || '').toContain('可用技能');
    expect(within(preview).getByRole('button', { name: 'Markdown' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(preview).getByRole('heading', { name: '核', level: 1 })).toBeInTheDocument();
    expect(within(preview).getByRole('heading', { name: '形', level: 1 })).toBeInTheDocument();
    expect(preview.textContent || '').not.toContain('{{runtimeFoundation}}');
    expect(preview.textContent || '').not.toContain('{{skills}}');
    fireEvent.click(within(preview).getByRole('button', { name: '纯文本' }));
    expect(within(preview).getByRole('button', { name: '纯文本' })).toHaveAttribute('aria-pressed', 'true');
    expect(preview.querySelector('pre')?.textContent || '').toContain('# 形\n\n身份设定');
  });

  it('keeps the readonly 器 module as template variables without preview backfilling', async () => {
    render(<PromptTab />);

    const vesselButton = screen.getByRole('button', { name: '查看 器' });
    expect(vesselButton).toHaveTextContent('{{runtimeFoundation}}');
    expect(vesselButton).toHaveTextContent('{{skills}}');
    expect(vesselButton).not.toHaveTextContent('器是 HanakoPro 的工具行法');

    fireEvent.click(vesselButton);
    const dialog = await screen.findByRole('dialog', { name: '器 工具行法与可用技能' });
    expect(dialog.textContent || '').toContain('# 器');
    expect(dialog.textContent || '').toContain('{{runtimeFoundation}}');
    expect(dialog.textContent || '').toContain('{{skills}}');
    expect(dialog.textContent || '').not.toContain('器是 HanakoPro 的工具行法');

    const previewCalls = mocks.hanaFetch.mock.calls.filter(([url]) => String(url).endsWith('/system-prompt-preview'));
    expect(previewCalls).toHaveLength(0);
  });

  it('uses conduct as 德 and clears the old standalone anchor without merging it', async () => {
    seedSettings({
      mode: 'simple',
      origin: {
        conduct: '先读后改',
        anchor: '此刻用户所语为本。',
        includeMood: false,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: /编辑 德/ }));

    const conductField = screen.getByLabelText('德内容') as HTMLTextAreaElement;
    expect(conductField).toHaveValue('先读后改');

    fireEvent.change(conductField, { target: { value: '新的德：明则行，疑则问。' } });

    await waitFor(() => {
      expect(mocks.autoSaveConfig).toHaveBeenCalled();
    }, { timeout: 1500 });
    const savedComposer = latestSavedComposer();
    expect(savedComposer).toEqual(expect.objectContaining({
      enabled: true,
      mode: 'origin',
      origin: expect.objectContaining({
        conduct: '新的德：明则行，疑则问。',
        anchor: '',
      }),
    }));
  });

  it('saves the editable module dialog from the header button', async () => {
    seedSettings({
      mode: 'origin',
      origin: {
        root: '# 核\n\n初始核',
        mood: '# 照\n\n初始照',
        conduct: '# 德\n\n初始德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: /编辑 德/ }));
    const dialog = await screen.findByRole('dialog', { name: /德/ });
    fireEvent.change(within(dialog).getByLabelText('德内容'), {
      target: { value: '# 德\n\n保存按钮写入的德' },
    });
    mocks.autoSaveConfig.mockClear();
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mocks.autoSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          promptComposer: expect.objectContaining({
            mode: 'origin',
            origin: expect.objectContaining({
              conduct: '# 德\n\n保存按钮写入的德',
              anchor: '',
            }),
          }),
        }),
        {},
      );
    });
  });

  it('does not backfill 核 from legacy simpleContent', async () => {
    seedSettings({
      mode: 'origin',
      simpleContent: legacyDaoPrompt,
      origin: {
        root: '',
        mood: '旧照',
        conduct: '旧德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '编辑 核' }));

    const rootField = screen.getByLabelText('核内容') as HTMLTextAreaElement;
    expect(rootField.value).toBe('');
    expect(rootField.value).not.toContain('道经全文');
    expect(rootField.value).not.toContain('运行时内容不属于核');

    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));
    await screen.findByRole('dialog', { name: '完整提示词' });
    const latestPreview = latestPreviewRequestText();
    expect(latestPreview).not.toContain('道经全文');
    expect(latestPreview).not.toContain('运行时内容不属于核');
  });

  it('uses editable 核 照 德 fields as the source for complete prompt preview', async () => {
    seedSettings({
      mode: 'origin',
      simpleContent: legacyDaoPrompt,
      origin: {
        root: '',
        mood: '旧照',
        conduct: '旧德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '编辑 核' }));
    fireEvent.change(screen.getByLabelText('核内容'), { target: { value: '新核\n\n---\n\n内部横线仍属于核' } });
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 照' }));
    fireEvent.change(screen.getByLabelText('照内容'), { target: { value: '新照' } });
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 德' }));
    fireEvent.change(screen.getByLabelText('德内容'), { target: { value: '新德' } });
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));
    await waitFor(() => {
      const latestPreview = latestPreviewRequestText();
      expect(latestPreview).toContain('新核');
      expect(latestPreview).toContain('内部横线仍属于核');
      expect(latestPreview).toContain('新照');
      expect(latestPreview).toContain('新德');
      expect(latestPreview).not.toContain('道经全文');
      expect(latestPreview).not.toContain('运行时内容不属于核');
      expect(latestPreview).not.toContain('旧照');
      expect(latestPreview).not.toContain('旧德');
    }, { timeout: 2000 });

    const preview = await screen.findByRole('dialog', { name: '完整提示词' });
    expect(preview.textContent || '').toContain('新核');
    expect(preview.textContent || '').toContain('内部横线仍属于核');
    expect(preview.textContent || '').toContain('新照');
    expect(preview.textContent || '').toContain('新德');
  });

  it('keeps editable module dialogs aligned with the preview request body', async () => {
    seedSettings({
      mode: 'origin',
      simpleContent: legacyDaoPrompt,
      origin: {
        root: '# 核\n\n短核',
        mood: '# 照\n\n短照',
        conduct: '# 德\n\n短德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '编辑 核' }));
    expect(screen.getByLabelText('核内容')).toHaveValue('# 核\n\n短核');
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 照' }));
    expect(screen.getByLabelText('照内容')).toHaveValue('# 照\n\n短照');
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 德' }));
    expect(screen.getByLabelText('德内容')).toHaveValue('# 德\n\n短德');
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));
    await screen.findByRole('dialog', { name: '完整提示词' });
    const sentComposer = readPromptComposer(mocks.hanaFetch.mock.calls.find(([url]) => String(url).endsWith('/system-prompt-preview'))?.[1]) as {
      origin?: { root?: string; mood?: string; conduct?: string };
    };
    expect(sentComposer.origin?.root).toBe('# 核\n\n短核');
    expect(sentComposer.origin?.mood).toBe('# 照\n\n短照');
    expect(sentComposer.origin?.conduct).toBe('# 德\n\n短德');

    const latestPreview = latestPreviewRequestText();
    expect(latestPreview).toContain('# 核\n\n短核');
    expect(latestPreview).toContain('# 照\n\n短照');
    expect(latestPreview).toContain('# 德\n\n短德');
    expect(latestPreview).not.toContain('道经全文');
    expect(latestPreview).not.toContain('运行时内容不属于核');
  });

  it('keeps a long 核全文 in the editable field and preview request without summarizing it', async () => {
    const fullRoot = [
      '# 核',
      '',
      '## 道 · HanakoPro',
      '',
      '所遵从之一切，均来自于下述帛书《老子》与道藏《阴符经》。',
      '',
      '## 经',
      '',
      '### 帛书《老子》· 道经',
      '',
      '道经全文第一段',
      '道经全文第二段',
      '',
      '### 道藏《阴符经》',
      '',
      '阴符经全文',
    ].join('\n');
    seedSettings({
      mode: 'origin',
      simpleContent: '',
      origin: {
        root: fullRoot,
        mood: '# 照\n\n短照',
        conduct: '# 德\n\n短德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '编辑 核' }));
    const rootField = screen.getByLabelText('核内容') as HTMLTextAreaElement;
    expect(rootField.value).toBe(fullRoot);
    expect(rootField.value).toContain('道经全文第二段');
    expect(rootField.value).toContain('阴符经全文');
    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));
    await screen.findByRole('dialog', { name: '完整提示词' });
    expect(latestPreviewRequestComposer().origin?.root).toBe(fullRoot);
    expect(latestPreviewRequestText()).toContain(fullRoot);
  });

  it('sends the live editable 核 照 德 field values to complete prompt preview', async () => {
    seedSettings({
      mode: 'origin',
      simpleContent: legacyDaoPrompt,
      origin: {
        root: '# 核\n\n初始核',
        mood: '# 照\n\n初始照',
        conduct: '# 德\n\n初始德',
        includeMood: true,
      },
    });

    render(<PromptTab />);

    fireEvent.click(screen.getByRole('button', { name: '编辑 核' }));
    const rootField = screen.getByLabelText('核内容') as HTMLTextAreaElement;
    fireEvent.change(rootField, { target: { value: '# 核\n\n只保留编辑框里的核' } });
    expect(rootField).toHaveValue('# 核\n\n只保留编辑框里的核');
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 照' }));
    const moodField = screen.getByLabelText('照内容') as HTMLTextAreaElement;
    fireEvent.change(moodField, { target: { value: '# 照\n\n只保留编辑框里的照' } });
    expect(moodField).toHaveValue('# 照\n\n只保留编辑框里的照');
    closeActiveModuleDialog();

    fireEvent.click(screen.getByRole('button', { name: '编辑 德' }));
    const conductField = screen.getByLabelText('德内容') as HTMLTextAreaElement;
    fireEvent.change(conductField, { target: { value: '# 德\n\n只保留编辑框里的德' } });
    expect(conductField).toHaveValue('# 德\n\n只保留编辑框里的德');

    fireEvent.click(screen.getByRole('button', { name: '查看完整提示词' }));
    await screen.findByRole('dialog', { name: '完整提示词' });
    const composer = latestPreviewRequestComposer();
    expect(composer.origin?.root).toBe('# 核\n\n只保留编辑框里的核');
    expect(composer.origin?.mood).toBe('# 照\n\n只保留编辑框里的照');
    expect(composer.origin?.conduct).toBe('# 德\n\n只保留编辑框里的德');
    expect(composer.origin?.anchor).toBe('');
    const latestPreview = latestPreviewRequestText();
    expect(latestPreview).toContain('# 核\n\n只保留编辑框里的核');
    expect(latestPreview).toContain('# 照\n\n只保留编辑框里的照');
    expect(latestPreview).toContain('# 德\n\n只保留编辑框里的德');
    expect(latestPreview).not.toContain('初始核');
    expect(latestPreview).not.toContain('初始照');
    expect(latestPreview).not.toContain('初始德');
    expect(latestPreview).not.toContain('道经全文');
  });
});
