// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputArea } from '../../components/InputArea';
import { useStore } from '../../stores';

const mocks = vi.hoisted(() => ({
  editorOptions: undefined as undefined | Record<string, unknown>,
  editorText: '',
  updateHandler: undefined as undefined | (() => void),
  insertContent: vi.fn(),
  setContent: vi.fn(),
  chainClearContent: vi.fn(),
  chainInserted: [] as unknown[],
  ensureSession: vi.fn(async () => true),
  loadSessions: vi.fn(),
  hanaFetch: vi.fn(),
  wsSend: vi.fn(),
}));

function editorJsonForText(text: string) {
  return {
    type: 'doc',
    content: text
      ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      : [],
  };
}

vi.mock('@tiptap/react', () => ({
  useEditor: (options: Record<string, unknown>) => {
    mocks.editorOptions = options;
    const chain = {
      clearContent: vi.fn(() => {
        mocks.chainClearContent();
        return chain;
      }),
      insertContent: vi.fn((content: unknown) => {
        mocks.chainInserted.push(content);
        return chain;
      }),
      focus: vi.fn(() => chain),
      run: vi.fn(),
    };
    return {
      commands: {
        focus: vi.fn(),
        clearContent: vi.fn(),
        scrollIntoView: vi.fn(),
        setContent: mocks.setContent,
        insertContent: mocks.insertContent,
      },
      chain: () => chain,
      getText: () => mocks.editorText,
      getJSON: () => editorJsonForText(mocks.editorText),
      isDestroyed: false,
      state: { tr: { setMeta: vi.fn(() => ({})) } },
      view: { dispatch: vi.fn() },
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'update') mocks.updateHandler = handler;
      }),
      off: vi.fn(),
    };
  },
  EditorContent: () => React.createElement('div', { 'data-testid': 'editor' }),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: () => ({}) },
}));

vi.mock('@tiptap/extension-bold', () => ({
  Bold: { extend: () => ({}) },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: { configure: () => ({ name: 'placeholder' }) },
}));

vi.mock('../../components/input/extensions/skill-badge', () => ({
  SkillBadge: { name: 'skillBadge' },
}));

vi.mock('../../components/input/extensions/file-badge', () => ({
  FileBadge: { name: 'fileBadge' },
}));

vi.mock('../../hooks/use-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
}));

vi.mock('../../hooks/use-config', () => ({
  fetchConfig: vi.fn(async () => ({})),
}));

vi.mock('../../hooks/use-hana-fetch', () => ({
  hanaFetch: (path: string, opts?: RequestInit) => mocks.hanaFetch(path, opts),
  hanaUrl: (path: string) => `http://127.0.0.1:3210${path}`,
}));

vi.mock('../../stores/session-actions', () => ({
  ensureSession: mocks.ensureSession,
  loadSessions: mocks.loadSessions,
}));

vi.mock('../../stores/desk-actions', () => ({
  loadDeskFiles: vi.fn(),
  searchDeskFiles: vi.fn(async () => []),
  toggleJianSidebar: vi.fn(),
}));

vi.mock('../../services/websocket', () => ({
  getWebSocket: vi.fn(() => ({ readyState: WebSocket.OPEN, send: mocks.wsSend })),
}));

vi.mock('../../MainContent', () => ({
  attachFilesFromPaths: vi.fn(),
}));

vi.mock('../../components/input/SlashCommandMenu', () => ({
  SlashCommandMenu: ({ commands, selected, onSelect }: { commands: Array<{ name: string }>; selected: number; onSelect: (command: { name: string }) => void }) => React.createElement(
    'div',
    { 'data-testid': 'slash-menu', 'data-selected': String(selected) },
    commands.map((command, index) => React.createElement(
      'button',
      {
        key: command.name,
        type: 'button',
        'data-testid': `slash-command-${command.name}`,
        'data-selected': String(index === selected),
        onClick: () => onSelect(command),
      },
      command.name,
    )),
  ),
}));

vi.mock('../../components/input/FileMentionMenu', () => ({
  FileMentionMenu: () => null,
}));

vi.mock('../../components/input/InputStatusBars', () => ({
  InputStatusBars: () => null,
}));

vi.mock('../../components/input/InputContextRow', () => ({
  InputContextRow: () => null,
}));

vi.mock('../../components/input/InputControlBar', () => ({
  InputControlBar: (props: {
    onGoalOpen: () => void;
    onGoalClose: () => void;
    goalEditing: boolean;
    goalDrafting?: boolean;
    onSlashToggle: () => void;
    onSend: () => void;
    slashBtnRef?: React.Ref<HTMLButtonElement>;
  }) => React.createElement(
    'div',
    null,
    React.createElement('button', {
      type: 'button',
      'data-testid': 'goal-toggle',
      'data-goal-editing': String(props.goalEditing),
      'data-goal-drafting': String(!!props.goalDrafting),
      onClick: props.goalEditing ? props.onGoalClose : props.onGoalOpen,
    }, 'goal'),
    React.createElement('button', {
      type: 'button',
      ref: props.slashBtnRef,
      'data-testid': 'slash-toggle',
      onClick: props.onSlashToggle,
    }, 'slash'),
    React.createElement('button', {
      type: 'button',
      'data-testid': 'send',
      onClick: props.onSend,
    }, 'send'),
  ),
}));

vi.mock('../../components/input/SessionConfirmationPrompt', () => ({
  SessionConfirmationPrompt: () => null,
}));

vi.mock('../../hooks/use-slash-items', () => ({
  useSkillSlashItems: () => [
    {
      name: 'zz-first',
      label: '/zz-first',
      description: 'first',
      busyLabel: '',
      icon: '',
      type: 'skill',
      execute: vi.fn(),
    },
    {
      name: 'zz-second',
      label: '/zz-second',
      description: 'second',
      busyLabel: '',
      icon: '',
      type: 'skill',
      execute: vi.fn(),
    },
  ],
}));

vi.mock('../../utils/paste-upload-feedback', () => ({
  notifyPasteUploadFailure: vi.fn(),
}));

vi.mock('../../services/stream-resume', () => ({
  replayStreamResume: vi.fn(),
  isStreamResumeRebuilding: () => null,
  isStreamScopedMessage: () => false,
  updateSessionStreamMeta: vi.fn(),
}));

function seedInputState(overrides: Partial<ReturnType<typeof useStore.getState>> = {}) {
  useStore.setState({
    currentSessionPath: '/session/input.jsonl',
    connected: true,
    pendingNewSession: false,
    streamingSessions: [],
    compactingSessions: [],
    inlineErrors: {},
    attachedFiles: [],
    attachedFilesBySession: {},
    docContextAttached: false,
    quotedSelection: null,
    models: [{
      id: 'deepseek-chat',
      provider: 'deepseek',
      name: 'DeepSeek Chat',
      input: ['text'],
      isCurrent: true,
    }],
    sessionModelsByPath: {},
    previewItems: [],
    previewOpen: false,
    activeTabId: null,
    chatSessions: {},
    serverPort: 3210,
    serverToken: null,
    modelSwitching: false,
    welcomeVisible: false,
    agentYuan: 'hanako',
    ...overrides,
  } as never);
}

function tiptapPasteHandler(): ((view: unknown, event: ClipboardEvent) => boolean | void) | undefined {
  const editorProps = mocks.editorOptions?.editorProps as Record<string, unknown> | undefined;
  return editorProps?.handlePaste as ((view: unknown, event: ClipboardEvent) => boolean | void) | undefined;
}

function tiptapKeyDownHandler(): ((view: unknown, event: KeyboardEvent) => boolean | void) | undefined {
  const editorProps = mocks.editorOptions?.editorProps as Record<string, unknown> | undefined;
  return editorProps?.handleKeyDown as ((view: unknown, event: KeyboardEvent) => boolean | void) | undefined;
}

async function typeEditorText(text: string) {
  await waitFor(() => {
    expect(mocks.updateHandler).toBeTypeOf('function');
  });
  mocks.editorText = text;
  act(() => {
    mocks.updateHandler?.();
  });
}

function installImageCompressionMocks() {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 4000,
    height: 3000,
    close,
  })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback, type?: string) => {
    callback(new Blob([new Uint8Array([4, 5, 6])], { type: type || 'image/jpeg' }));
  });
}

describe('InputArea paste and slash menu behavior', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editorOptions = undefined;
    mocks.editorText = '';
    mocks.updateHandler = undefined;
    mocks.chainClearContent.mockClear();
    mocks.chainInserted = [];
    seedInputState();
    mocks.hanaFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    window.platform = {} as typeof window.platform;
  });

  it('consumes a rich URL paste through the TipTap paste hook before the default editor paste runs', () => {
    render(React.createElement(InputArea));

    const preventDefault = vi.fn();
    const result = tiptapPasteHandler()?.(null, {
      preventDefault,
      clipboardData: {
        items: [],
        getData: (type: string) => ({
          'text/plain': 'Example Article',
          'text/html': '<a href="https://example.com/article">Example Article</a>',
          'text/uri-list': '',
        }[type] ?? ''),
      },
    } as unknown as ClipboardEvent);

    expect(result).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mocks.insertContent).toHaveBeenCalledWith('https://example.com/article');
  });

  it('selects the highlighted slash command on Enter without falling through to message send', async () => {
    render(React.createElement(InputArea));

    await waitFor(() => {
      expect(mocks.updateHandler).toBeTypeOf('function');
    });

    mocks.editorText = '/zz';
    act(() => {
      mocks.updateHandler?.();
    });

    await screen.findByTestId('slash-menu');
    fireEvent.keyDown(screen.getByTestId('editor'), { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByTestId('slash-menu').getAttribute('data-selected')).toBe('1');
    });

    fireEvent.keyDown(screen.getByTestId('editor'), { key: 'Enter' });

    expect(mocks.chainInserted).toContainEqual({
      type: 'skillBadge',
      attrs: { name: 'zz-second' },
    });
    expect(mocks.wsSend).not.toHaveBeenCalled();
  });

  it('keeps typed text visible when initial goal mode starts', async () => {
    render(React.createElement(InputArea));
    await typeEditorText('修复目标模式草稿');
    mocks.setContent.mockClear();

    fireEvent.click(screen.getByTestId('goal-toggle'));

    expect(mocks.setContent).not.toHaveBeenCalledWith('', expect.anything());
    expect(screen.getByTestId('goal-toggle').getAttribute('data-goal-drafting')).toBe('true');
  });

  it('opens the skill menu from the star button while drafting an initial goal', async () => {
    render(React.createElement(InputArea));
    await typeEditorText('修复目标模式草稿');

    fireEvent.click(screen.getByTestId('goal-toggle'));
    fireEvent.click(screen.getByTestId('slash-toggle'));

    expect(await screen.findByTestId('slash-menu')).toBeTruthy();
  });

  it('selects a slash skill on Enter while drafting an initial goal instead of submitting the goal', async () => {
    render(React.createElement(InputArea));

    fireEvent.click(screen.getByTestId('goal-toggle'));
    await typeEditorText('/zz');

    await screen.findByTestId('slash-menu');
    fireEvent.keyDown(screen.getByTestId('editor'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByTestId('editor'), { key: 'Enter' });

    expect(mocks.chainInserted).toContainEqual({
      type: 'skillBadge',
      attrs: { name: 'zz-second' },
    });
    expect(mocks.chainClearContent).toHaveBeenCalledTimes(1);
    expect(mocks.hanaFetch).not.toHaveBeenCalledWith('/api/session-goal', expect.anything());
    expect(mocks.wsSend).not.toHaveBeenCalled();
  });

  it('handles welcome Enter inside TipTap before the editor inserts a newline', async () => {
    seedInputState({
      currentSessionPath: null,
      pendingNewSession: true,
      welcomeVisible: true,
    });
    mocks.editorText = '你好 Hana';
    render(React.createElement(InputArea));

    const preventDefault = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    const handled = tiptapKeyDownHandler()?.(null, event);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.ensureSession).toHaveBeenCalledTimes(1);
      expect(mocks.loadSessions).toHaveBeenCalledTimes(1);
      expect(mocks.wsSend).toHaveBeenCalledTimes(1);
    });
  });

  it('compresses oversized pasted images before upload-blob', async () => {
    installImageCompressionMocks();
    mocks.hanaFetch.mockImplementation(async (path: string) => {
      if (path === '/api/upload-blob') {
        return new Response(JSON.stringify({
          uploads: [{
            fileId: 'sf_compressed_paste',
            dest: '/hana/session-files/pasted.jpg',
            name: 'pasted.jpg',
            isDirectory: false,
          }],
        }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    render(React.createElement(InputArea));

    const preventDefault = vi.fn();
    const file = new File([new Uint8Array(900 * 1024)], 'clipboard.png', { type: 'image/png' });
    const handled = tiptapPasteHandler()?.(null, {
      preventDefault,
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        }],
      },
    } as unknown as ClipboardEvent);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.hanaFetch).toHaveBeenCalledWith('/api/upload-blob', expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }));
    });
    const uploadCall = mocks.hanaFetch.mock.calls.find(([path]) => path === '/api/upload-blob');
    const body = JSON.parse(String(uploadCall?.[1]?.body));
    expect(body).toMatchObject({
      name: 'input.pastedImage.jpg',
      mimeType: 'image/jpeg',
      base64Data: 'BAUG',
      sessionPath: '/session/input.jsonl',
    });
    expect(useStore.getState().attachedFiles).toEqual([{
      fileId: 'sf_compressed_paste',
      path: '/hana/session-files/pasted.jpg',
      name: 'pasted.jpg',
      isDirectory: false,
    }]);
  });
});
