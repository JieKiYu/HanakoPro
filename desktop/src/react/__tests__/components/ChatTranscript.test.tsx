// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatTranscript } from '../../components/chat/ChatTranscript';
import type { ChatListItem } from '../../stores/chat-types';

describe('ChatTranscript', () => {
  it('renders compaction markers as visible dividers', () => {
    const items: ChatListItem[] = [
      { type: 'compaction', id: 'c1', yuan: '上下文已自动压缩' },
    ];

    render(<ChatTranscript items={items} sessionPath="/s/test.jsonl" />);

    expect(screen.getByRole('separator', { name: '上下文已自动压缩' })).toBeInTheDocument();
    expect(screen.getByText('上下文已自动压缩')).toBeInTheDocument();
  });

  it('hides duplicate goal conclusion text that arrives in a later assistant message of the same turn', () => {
    const items: ChatListItem[] = [
      { type: 'message', data: { id: 'u1', role: 'user', text: '跑目标验收' } },
      {
        type: 'message',
        data: {
          id: 'a-tools',
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
              evidence: '验真已合：已用 Hanako 内置浏览器打开本地预览并绑定 Browser 窗口可见检查，页面显示守一缝机诊断画布、Online 状态、6 板块/18 明细图/146 事件，且点击图表区域可响应。',
              usage: '目标用量：37171 tokens，用时约 2分 55 秒。',
            },
          ],
        },
      },
      {
        type: 'message',
        data: {
          id: 'a-duplicate',
          role: 'assistant',
          blocks: [{
            type: 'text',
            html: '<p>验真已合：已用 Hanako 内置浏览器打开本地预览并绑定 Browser 窗口可见检查，页面显示守一缝机诊断画布、Online 状态、6 板块 / 18 明细图 / 146 事件，且点击图表区域可响应。</p>',
            source: '验真已合：已用 Hanako 内置浏览器打开本地预览并绑定 Browser 窗口可见检查，页面显示守一缝机诊断画布、Online 状态、6 板块 / 18 明细图 / 146 事件，且点击图表区域可响应。',
          }],
        },
      },
    ];

    render(<ChatTranscript items={items} sessionPath="/s/test.jsonl" readOnly />);

    expect(screen.getAllByText(/验真已合/)).toHaveLength(1);
    expect(screen.getByText('目标用量：37171 tokens，用时约 2分 55 秒。')).toBeInTheDocument();
    expect(screen.queryByText(/6 板块 \/ 18 明细图 \/ 146 事件/)).toBeNull();
  });

  it('keeps a new turn conclusion text visible until that turn has its own conclusion card', () => {
    const items: ChatListItem[] = [
      { type: 'message', data: { id: 'u1', role: 'user', text: '第一次目标' } },
      {
        type: 'message',
        data: {
          id: 'a-card',
          role: 'assistant',
          blocks: [{
            type: 'goal_acceptance_conclusion',
            evidence: '验真已合：第一次已验，目标收束。',
            usage: '目标用量：100 tokens，用时约 0分 10 秒。',
          }],
        },
      },
      { type: 'message', data: { id: 'u2', role: 'user', text: '第二次目标' } },
      {
        type: 'message',
        data: {
          id: 'a-text',
          role: 'assistant',
          blocks: [{
            type: 'text',
            html: '<p>验真已合：第二次已验，目标收束。</p>',
            source: '验真已合：第二次已验，目标收束。',
          }],
        },
      },
    ];

    render(<ChatTranscript items={items} sessionPath="/s/test.jsonl" readOnly />);

    expect(screen.getByText('验真已合：第一次已验，目标收束。')).toBeInTheDocument();
    expect(screen.getByText('验真已合：第二次已验，目标收束。')).toBeInTheDocument();
  });
});
