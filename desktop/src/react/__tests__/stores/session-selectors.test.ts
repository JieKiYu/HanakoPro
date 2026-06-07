import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTED_IDS,
  selectIsStreamingSession,
  selectLatestTerminalSession,
  selectSelectedIdsBySession,
} from '../../stores/session-selectors';

describe('session-selectors', () => {
  it('缺失 session key 时返回稳定空数组引用', () => {
    const state = {
      selectedIdsBySession: {},
      streamingSessions: [],
    };

    expect(selectSelectedIdsBySession(state, '/missing')).toBe(EMPTY_SELECTED_IDS);
    expect(selectSelectedIdsBySession(state, '/missing')).toBe(EMPTY_SELECTED_IDS);
    expect(selectSelectedIdsBySession(state, '')).toBe(EMPTY_SELECTED_IDS);
  });

  it('命中 session key 时返回该 session 自己的选中列表', () => {
    const selected = ['m-1', 'm-2'];
    const state = {
      selectedIdsBySession: {
        '/panel': selected,
        '/current': ['other'],
      },
      streamingSessions: [],
    };

    expect(selectSelectedIdsBySession(state, '/panel')).toBe(selected);
  });

  it('streaming 判断只依赖显式 sessionPath', () => {
    const state = {
      selectedIdsBySession: {},
      streamingSessions: ['/panel'],
    };

    expect(selectIsStreamingSession(state, '/panel')).toBe(true);
    expect(selectIsStreamingSession(state, '/current')).toBe(false);
    expect(selectIsStreamingSession(state, '')).toBe(false);
  });

  it('返回当前会话最近的 AI 终端会话，供顶栏按钮聚焦', () => {
    const state = {
      chatSessions: {
        '/current': {
          items: [
            { type: 'message' as const, data: { id: 'u1', role: 'user' as const, text: 'run tests' } },
            {
              type: 'message' as const,
              data: {
                id: 'a1',
                role: 'assistant' as const,
                blocks: [{
                  type: 'tool_group' as const,
                  collapsed: false,
                  tools: [{
                    name: 'terminal_create',
                    args: {},
                    done: true,
                    success: true,
                    details: { id: 'term-old', title: 'Old', cwd: '/old', alive: false },
                  }],
                }],
              },
            },
            {
              type: 'message' as const,
              data: {
                id: 'a2',
                role: 'assistant' as const,
                blocks: [{
                  type: 'tool_group' as const,
                  collapsed: false,
                  tools: [{
                    name: 'terminal_write',
                    args: { id: 'term-new' },
                    done: false,
                    success: false,
                    details: { id: 'term-new', title: 'Tests', cwd: '/repo', alive: true },
                  }],
                }],
              },
            },
          ],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state, '/current')).toEqual({
      id: 'term-new',
      title: 'Tests',
      cwd: '/repo',
      alive: true,
      running: true,
    });
  });

  it('没有终端工具时返回 null', () => {
    const state = {
      chatSessions: {
        '/current': {
          items: [{
            type: 'message' as const,
            data: {
              id: 'a1',
              role: 'assistant' as const,
              blocks: [{
                type: 'tool_group' as const,
                collapsed: false,
                tools: [{ name: 'read', args: { path: '/tmp/a' }, done: true, success: true }],
              }],
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state, '/current')).toBeNull();
  });
});
