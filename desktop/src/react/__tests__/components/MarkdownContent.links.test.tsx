// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownContent } from '../../components/chat/MarkdownContent';
import { useStore } from '../../stores';

const mocks = vi.hoisted(() => ({
  openFilePreview: vi.fn(),
}));

vi.mock('../../utils/file-preview', () => ({
  openFilePreview: mocks.openFilePreview,
}));

describe('MarkdownContent link handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).platform = {
      openExternal: vi.fn(),
    };
    useStore.setState({
      sessions: [{
        path: '/session.jsonl',
        cwd: '/Users/jieki/workspace/trading_strategy_lab',
        title: null,
        firstMessage: '',
        modified: '',
        messageCount: 1,
        agentId: null,
        agentName: null,
      }],
    } as never);
  });

  afterEach(() => {
    cleanup();
    delete (window as any).platform;
  });

  it('本地绝对路径链接剥掉行号后走文件预览，不导航主窗口', () => {
    const { getByText } = render(
      <MarkdownContent
        sessionPath="/session.jsonl"
        html={'<p>改动在 <a href="/Users/jieki/workspace/trading_strategy_lab/reports/diagnostics/index.html:108">reports/diagnostics/index.html</a></p>'}
      />,
    );

    fireEvent.click(getByText('reports/diagnostics/index.html'));

    expect(mocks.openFilePreview).toHaveBeenCalledWith(
      '/Users/jieki/workspace/trading_strategy_lab/reports/diagnostics/index.html',
      'reports/diagnostics/index.html',
      'html',
      { origin: 'session', sessionPath: '/session.jsonl' },
    );
  });

  it('file URL 链接剥掉行号后走文件预览，不导航主窗口', () => {
    const { getByText } = render(
      <MarkdownContent
        sessionPath="/session.jsonl"
        html={'<p>改动在 <a href="file:///Users/jieki/workspace/trading_strategy_lab/reports/diagnostics/index.html:108">reports/diagnostics/index.html</a></p>'}
      />,
    );

    fireEvent.click(getByText('reports/diagnostics/index.html'));

    expect(mocks.openFilePreview).toHaveBeenCalledWith(
      '/Users/jieki/workspace/trading_strategy_lab/reports/diagnostics/index.html',
      'reports/diagnostics/index.html',
      'html',
      { origin: 'session', sessionPath: '/session.jsonl' },
    );
  });

  it('相对文件链接基于当前 session cwd 解析为真实文件路径', () => {
    const { getByText } = render(
      <MarkdownContent
        sessionPath="/session.jsonl"
        html={'<p><a href="reports/diagnostics/index.html:108">reports/diagnostics/index.html</a></p>'}
      />,
    );

    fireEvent.click(getByText('reports/diagnostics/index.html'));

    expect(mocks.openFilePreview).toHaveBeenCalledWith(
      '/Users/jieki/workspace/trading_strategy_lab/reports/diagnostics/index.html',
      'reports/diagnostics/index.html',
      'html',
      { origin: 'session', sessionPath: '/session.jsonl' },
    );
  });

  it('无法解析的相对链接会阻止默认导航，避免 Electron 主窗口白屏', () => {
    const { getByText } = render(
      <MarkdownContent
        html={'<p><a href="reports/diagnostics/index.html:108">reports/diagnostics/index.html</a></p>'}
      />,
    );

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const shouldNavigate = getByText('reports/diagnostics/index.html').dispatchEvent(event);

    expect(shouldNavigate).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(mocks.openFilePreview).not.toHaveBeenCalled();
  });

  it('HTTP 链接走系统外部打开，不导航主窗口', () => {
    const { getByText } = render(
      <MarkdownContent html={'<p><a href="https://example.com/path">example</a></p>'} />,
    );

    fireEvent.click(getByText('example'));

    expect(window.platform?.openExternal).toHaveBeenCalledWith('https://example.com/path');
    expect(mocks.openFilePreview).not.toHaveBeenCalled();
  });
});
