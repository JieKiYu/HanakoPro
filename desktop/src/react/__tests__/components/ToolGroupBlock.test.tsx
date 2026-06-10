// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolGroupBlock } from '../../components/chat/ToolGroupBlock';
import { AssistantMessage } from '../../components/chat/AssistantMessage';
import { ChatTranscript } from '../../components/chat/ChatTranscript';
import { BrowserCard } from '../../components/BrowserCard';
import { useStore } from '../../stores';
import type { ChatListItem } from '../../stores/chat-types';

const hanaFetchMock = vi.fn();

vi.mock('../../hooks/use-hana-fetch', () => ({
  hanaFetch: (...args: unknown[]) => hanaFetchMock(...args),
}));

describe('ToolGroupBlock', () => {
  beforeEach(() => {
    window.t = ((key: string) => key) as typeof window.t;
    window.platform = {
      openBrowserViewer: vi.fn(),
    } as unknown as typeof window.platform;
    hanaFetchMock.mockResolvedValue({
      json: async () => ({ ok: true }),
    });
    useStore.setState({ settingsModal: { open: false, activeTab: 'agent' } } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows the full bash command in the hover title when the visible detail is truncated', () => {
    const command = 'rm -rf /Users/jason/.claude/plugins/marketplaces/temp_*';

    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'bash',
          args: { command },
          done: true,
          success: true,
        }]}
      />,
    );

    const detail = screen.getByTitle(command);

    expect(detail.textContent).toBe('rm -rf /Users/jason/.claude/plugins/mar…');
  });

  it('keeps expanded tool args whole so the details pane can scroll instead of truncating content', () => {
    const longContent = `${'a'.repeat(900)}TAIL_MARKER`;

    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'write',
          args: { path: '/tmp/large.txt', content: longContent },
          done: true,
          success: true,
        }]}
      />,
    );

    const indicator = screen.getByText('tool._fallback.done').closest('[data-tool="write"]');
    expect(indicator).toBeTruthy();
    fireEvent.click(indicator as HTMLElement);

    expect(screen.getByText((text) => text.includes('TAIL_MARKER'))).toBeTruthy();
    expect(screen.queryByText((text) => text.includes('\n…'))).toBeNull();
  });

  it('syncs a multi-tool group to collapsed when the completed block updates', () => {
    const { rerender } = render(
      <ToolGroupBlock
        collapsed={false}
        tools={[
          { name: 'bash', args: { command: 'npm test' }, done: true, success: true },
          { name: 'read', args: { file_path: '/tmp/report.md' }, done: false, success: false },
        ]}
      />,
    );

    const content = screen.getByText('npm test').closest('div')?.parentElement;
    expect(content).toBeTruthy();
    expect(content?.className).not.toContain('toolGroupContentCollapsed');

    rerender(
      <ToolGroupBlock
        collapsed={true}
        tools={[
          { name: 'bash', args: { command: 'npm test' }, done: true, success: true },
          { name: 'read', args: { file_path: '/tmp/report.md' }, done: true, success: true },
        ]}
      />,
    );

    expect(content?.className).toContain('toolGroupContentCollapsed');
  });

  it('keeps a single tool as a plain indicator without a fold summary', () => {
    render(
      <ToolGroupBlock
        collapsed={true}
        tools={[{
          name: 'bash',
          args: { command: 'npm test' },
          done: true,
          success: true,
        }]}
      />,
    );

    expect(screen.queryByText('toolGroup.count')).toBeNull();
    expect(screen.getByText('npm test')).toBeTruthy();
  });

  it('shows a live remaining countdown for running wait tools', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'wait',
          args: {
            seconds: 30,
            startedAt: 1_700_000_000_000,
            durationMs: 30_000,
          },
          done: false,
          success: false,
        }]}
      />,
    );

    expect(screen.getByText('30s')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(11_000);
    });

    expect(screen.getByText('19s')).toBeTruthy();
  });

  it('marks thinking visually complete while showing a separate file-write preparation hint', () => {
    render(
      <AssistantMessage
        showAvatar={false}
        sessionPath="/sessions/main.jsonl"
        readOnly
        message={{
          id: 'a1',
          role: 'assistant',
          blocks: [{
            type: 'thinking',
            sealed: false,
            content: '用户要求我只使用 write 工具，将《道德经》全文写入一个文件。',
          }],
        }}
      />,
    );

    expect(screen.getByText('thinking.done')).toBeTruthy();
    expect(screen.queryByText('thinking.active')).toBeNull();
    expect(screen.getByText('正在准备写入文件内容')).toBeTruthy();
  });

  it('expands completed thinking when the block contains reasoning text', () => {
    render(
      <AssistantMessage
        showAvatar={false}
        sessionPath="/sessions/main.jsonl"
        readOnly
        message={{
          id: 'a-thinking',
          role: 'assistant',
          blocks: [{
            type: 'thinking',
            sealed: true,
            content: '我会先打开网页，再点击动画入口。',
          }],
        }}
      />,
    );

    expect(screen.queryByText('我会先打开网页，再点击动画入口。')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '› thinking.done' }));
    expect(screen.getByText('我会先打开网页，再点击动画入口。')).toBeVisible();
  });

  it('hides empty completed thinking without changing the following tool group', () => {
    render(
      <AssistantMessage
        showAvatar={false}
        sessionPath="/sessions/main.jsonl"
        readOnly
        message={{
          id: 'a-empty-thinking-tool',
          role: 'assistant',
          blocks: [
            { type: 'thinking', sealed: true, content: '' },
            {
              type: 'tool_group',
              collapsed: false,
              tools: [{
                name: 'browser',
                args: { action: 'navigate', url: 'https://www.bilibili.com/' },
                done: true,
                success: true,
              }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText('thinking.done')).toBeNull();
    expect(screen.getByText('tool._fallback.done')).toBeTruthy();
  });

  it('hides completed thinking that only contains invisible control characters', () => {
    render(
      <AssistantMessage
        showAvatar={false}
        sessionPath="/sessions/main.jsonl"
        readOnly
        message={{
          id: 'a-invisible-thinking-tool',
          role: 'assistant',
          blocks: [
            { type: 'thinking', sealed: true, content: '\u200B\u200F\u2060\uFEFF\n\t' },
            {
              type: 'tool_group',
              collapsed: false,
              tools: [{
                name: 'status',
                args: {},
                done: true,
                success: true,
              }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText('thinking.done')).toBeNull();
    expect(screen.getByText('tool._fallback.done')).toBeTruthy();
  });

  it('renders goal acceptance conclusion outside the tool group and hides duplicate conclusion text', () => {
    const { container } = render(
      <AssistantMessage
        showAvatar={false}
        sessionPath="/sessions/main.jsonl"
        readOnly
        message={{
          id: 'a-goal-conclusion',
          role: 'assistant',
          blocks: [
            {
              type: 'tool_group',
              collapsed: false,
              tools: [{
                name: 'session_goal',
                args: { action: 'complete' },
                done: true,
                success: true,
                details: { action: 'complete' },
              }],
            },
            {
              type: 'goal_acceptance_conclusion',
              evidence: '验真已合：已复走预览入口，确认页面可见，目标收束。',
              usage: '目标用量：39187 tokens，用时约 1分 58 秒。',
            },
            {
              type: 'text',
              html: '<p>验真已合：已复走预览入口，确认页面可见，目标收束。</p>',
              source: '验真已合：已复走预览入口，确认页面可见，目标收束。',
            },
          ],
        }}
      />,
    );

    const conclusion = screen.getByText('验真已合：已复走预览入口，确认页面可见，目标收束。');
    const conclusionCard = conclusion.closest('[class*="goalAcceptanceConclusion"]');
    const toolGroup = container.querySelector('[class*="toolGroup"]');
    expect(conclusionCard).toBeTruthy();
    expect(toolGroup).toBeTruthy();
    expect(toolGroup?.contains(conclusionCard)).toBe(false);
    expect(screen.getAllByText('验真已合：已复走预览入口，确认页面可见，目标收束。')).toHaveLength(1);
  });

  it('shows only one browser reply tag at the latest assistant message for a completed turn', async () => {
    const items: ChatListItem[] = [
      {
        type: 'message',
        data: {
          id: 'u1',
          role: 'user',
          text: '打开 B 站动画页面',
        },
      },
      {
        type: 'message',
        data: {
          id: 'a-browser-1',
          role: 'assistant',
          blocks: [{
            type: 'tool_group',
            collapsed: true,
            tools: [{
              name: 'browser',
              args: { action: 'navigate', url: 'https://www.bilibili.com/' },
              done: true,
              success: true,
              details: {
                action: 'navigate',
                running: true,
                url: 'https://www.bilibili.com/',
              },
            }],
          }],
        },
      },
      {
        type: 'message',
        data: {
          id: 'a-browser-2',
          role: 'assistant',
          blocks: [{
            type: 'tool_group',
            collapsed: true,
            tools: [{
              name: 'browser',
              args: { action: 'click' },
              done: true,
              success: true,
              details: {
                action: 'click',
                running: true,
                url: 'https://www.bilibili.com/c/douga/?spm_id_from=333.1007.0.0',
              },
            }],
          }],
        },
      },
      {
        type: 'message',
        data: {
          id: 'a-final',
          role: 'assistant',
          blocks: [{
            type: 'text',
            html: '<p>已打开 B 站，并进入「动画」页面。</p>',
          }],
        },
      },
    ];

    render(
      <ChatTranscript
        items={items}
        sessionPath="/sessions/main.jsonl"
        readOnly
      />,
    );

    const tags = screen.getAllByRole('button', { name: 'browser.using: www.bilibili.com' });
    expect(tags).toHaveLength(1);
    const tag = tags[0];
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveAttribute('title', 'https://www.bilibili.com/c/douga/?spm_id_from=333.1007.0.0');
    expect(screen.getByText('已打开 B 站，并进入「动画」页面。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /撤回此轮/ })).toBeNull();

    fireEvent.click(tag);

    await vi.waitFor(() => {
      expect(hanaFetchMock).toHaveBeenCalledWith('/api/browser/show-session', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionPath: '/sessions/main.jsonl' }),
      }));
    });
    expect(window.platform?.openBrowserViewer).not.toHaveBeenCalled();
  });

  it('places the browser reply tag between the final text and the revert row', () => {
    render(
      <ChatTranscript
        items={[
          {
            type: 'message',
            data: { id: 'u1', role: 'user', text: '打开 B 站动画页面' },
          },
          {
            type: 'message',
            data: {
              id: 'a-browser',
              role: 'assistant',
              blocks: [{
                type: 'tool_group',
                collapsed: true,
                tools: [{
                  name: 'browser',
                  args: { action: 'navigate', url: 'https://www.bilibili.com/' },
                  done: true,
                  success: true,
                  details: {
                    action: 'navigate',
                    running: true,
                    url: 'https://www.bilibili.com/',
                  },
                }],
              }],
            },
          },
          {
            type: 'message',
            data: {
              id: 'a-final',
              role: 'assistant',
              blocks: [{ type: 'text', html: '<p>已打开 B 站，并进入「动画」页面。</p>' }],
            },
          },
        ]}
        sessionPath="/sessions/main.jsonl"
      />,
    );

    const tag = screen.getByRole('button', { name: 'browser.using: www.bilibili.com' });
    const revert = screen.getByRole('button', { name: /chat\.revertTurn|撤回此轮/ });
    const tagRow = tag.parentElement;
    const revertRow = revert.parentElement;

    expect(tagRow).toBeTruthy();
    expect(revertRow).toBeTruthy();
    const tagRowNode = tagRow as HTMLElement;
    const revertRowNode = revertRow as HTMLElement;
    expect(tagRowNode).not.toBe(revertRowNode);
    expect(tagRowNode.compareDocumentPosition(revertRowNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the latest-turn browser reply tag when the latest browser result is stopped', () => {
    render(
      <ChatTranscript
        items={[
          {
            type: 'message',
            data: { id: 'u1', role: 'user', text: '打开再关闭浏览器' },
          },
          {
            type: 'message',
            data: {
              id: 'a-browser-stopped',
              role: 'assistant',
              blocks: [{
                type: 'tool_group',
                collapsed: true,
                tools: [
                  {
                    name: 'browser',
                    args: { action: 'navigate', url: 'https://www.bilibili.com/anime/' },
                    done: true,
                    success: true,
                    details: {
                      action: 'navigate',
                      running: true,
                      url: 'https://www.bilibili.com/anime/',
                    },
                  },
                  {
                    name: 'browser',
                    args: { action: 'stop' },
                    done: true,
                    success: true,
                    details: {
                      action: 'stop',
                      running: false,
                      url: null,
                    },
                  },
                ],
              }],
            },
          },
          {
            type: 'message',
            data: {
              id: 'a-final',
              role: 'assistant',
              blocks: [{ type: 'text', html: '<p>已关闭。</p>' }],
            },
          },
        ]}
        sessionPath="/sessions/main.jsonl"
        readOnly
      />,
    );

    expect(screen.queryByRole('button', { name: /www\.bilibili\.com/ })).toBeNull();
  });

  it('dismisses the floating browser card after opening the viewer without stopping the browser', () => {
    useStore.setState({
      currentSessionPath: '/sessions/main.jsonl',
      browserBySession: {
        '/sessions/main.jsonl': {
          running: true,
          url: 'https://www.bilibili.com/',
          thumbnail: null,
        },
      },
    } as never);

    render(<BrowserCard />);

    const card = screen.getByText('browser.using').closest('#browserFloatingCard');
    expect(card).toBeTruthy();

    fireEvent.click(card as HTMLElement);

    expect(window.platform?.openBrowserViewer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('browser.using')).toBeNull();
    expect(useStore.getState().browserBySession['/sessions/main.jsonl']?.running).toBe(true);
  });

  it('shows a Windsurf-style live file card without unreliable percentage progress', () => {
    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'write',
          args: { path: 'large.md' },
          done: false,
          success: false,
          progress: {
            stage: 'writing',
            fileName: 'large.md',
            operation: 'created',
            previewText: '# Demo\n\n正在写入内容',
            bytesWritten: 50,
            totalBytes: 100,
            progress: 0.5,
          },
        }]}
      />,
    );

    expect(screen.getAllByText('large.md').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.getByText(/正在写入内容/)).toBeTruthy();
    expect(screen.queryByText(/50%/)).toBeNull();
  });

  it('shows a Windsurf-style memory update notice with a Manage shortcut', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'pin_memory',
          args: { content: '我是博士' },
          done: true,
          success: true,
          details: { memoryChanged: true },
        }]}
      />,
    );

    expect(screen.getByText('Auto-generated memory was updated')).toBeTruthy();
    expect(screen.getByText('Created "我是博士" memory')).toBeTruthy();

    screen.getByRole('button', { name: /Manage/ }).click();

    expect(useStore.getState().settingsModal).toEqual({ open: true, activeTab: 'memory' });
    expect(window.sessionStorage.getItem('hana-settings-focus')).toBe('memory-management');
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'hana-focus-memory-management' }));
  });

  it('does not show the memory notice when pin_memory made no change', () => {
    render(
      <ToolGroupBlock
        collapsed={false}
        tools={[{
          name: 'pin_memory',
          args: { content: '我是博士' },
          done: true,
          success: true,
          details: { memoryChanged: false },
        }]}
      />,
    );

    expect(screen.queryByText('Auto-generated memory was updated')).toBeNull();
  });
});
