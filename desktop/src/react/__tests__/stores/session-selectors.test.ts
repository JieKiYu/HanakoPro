import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTED_IDS,
  selectIsStreamingSession,
  selectLatestActiveTerminalSession,
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

  it('不会把历史里的已完成终端当作当前可连接终端', () => {
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
                tools: [{
                  name: 'terminal_write',
                  args: { id: 'term-old' },
                  done: true,
                  success: true,
                  details: { id: 'term-old', title: 'Old', cwd: '/repo' },
                }],
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

  it('旧 tool_group 缺失 tools 时不会让终端选择器崩溃', () => {
    const state = {
      chatSessions: {
        '/legacy': {
          items: [{
            type: 'message' as const,
            data: {
              id: 'a1',
              role: 'assistant' as const,
              blocks: [{ type: 'tool_group' as const, collapsed: false }] as any,
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state as any, '/legacy')).toBeNull();
  });

  it('旧 tool_group.tools 不是数组时跳过该块', () => {
    const state = {
      chatSessions: {
        '/legacy': {
          items: [{
            type: 'message' as const,
            data: {
              id: 'a1',
              role: 'assistant' as const,
              blocks: [{
                type: 'tool_group',
                collapsed: false,
                tools: { name: 'terminal_write', details: { id: 'bad' }, done: false },
              }] as any,
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state as any, '/legacy')).toBeNull();
  });

  it('跳过畸形工具项，但保留同组合法 terminal 工具', () => {
    const state = {
      chatSessions: {
        '/legacy': {
          items: [{
            type: 'message' as const,
            data: {
              id: 'a1',
              role: 'assistant' as const,
              blocks: [{
                type: 'tool_group' as const,
                collapsed: false,
                tools: [
                  null,
                  { args: { id: 'missing-name' }, done: false },
                  { name: 123, details: { id: 'wrong-name' }, done: false },
                  {
                    name: 'terminal_wait',
                    args: { id: 'term-live' },
                    done: false,
                    success: false,
                    details: { id: 'term-live', title: 'Live', cwd: '/repo', alive: true },
                  },
                ] as any,
              }],
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state as any, '/legacy')).toEqual({
      id: 'term-live',
      title: 'Live',
      cwd: '/repo',
      alive: true,
      running: true,
    });
  });

  it('非运行态会话不把历史 alive 终端当作底部终端接管目标', () => {
    const state = {
      streamingSessions: [],
      chatSessions: {
        '/old': {
          items: [{
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
                  details: { id: 'historical-term', title: 'Old', cwd: '/old', alive: true },
                }],
              }],
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestTerminalSession(state, '/old')).toEqual({
      id: 'historical-term',
      title: 'Old',
      cwd: '/old',
      alive: true,
      running: false,
    });
    expect(selectLatestActiveTerminalSession(state, '/old')).toBeNull();
  });

  it('运行态会话才允许底部终端接管最近活动终端', () => {
    const state = {
      streamingSessions: ['/current'],
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
                tools: [{
                  name: 'terminal_write',
                  args: { id: 'active-term' },
                  done: false,
                  success: false,
                  details: { id: 'active-term', cwd: '/repo', alive: true },
                }],
              }],
            },
          }],
          hasMore: false,
          loadingMore: false,
        },
      },
    };

    expect(selectLatestActiveTerminalSession(state, '/current')).toEqual({
      id: 'active-term',
      title: undefined,
      cwd: '/repo',
      alive: true,
      running: true,
    });
  });
});
