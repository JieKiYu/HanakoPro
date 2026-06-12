import { describe, expect, it } from 'vitest';
import { chooseInlineTerminal } from '../../terminal/inline-terminal-selection';

describe('chooseInlineTerminal', () => {
  it('优先连接当前会话里正在运行的 AI 终端', () => {
    const choice = chooseInlineTerminal({
      session: { path: '/session/a.jsonl', cwd: '/repo' },
      activeTerminal: { id: 'ai-term', title: 'Tests', cwd: '/repo', alive: true, running: true },
      defaultTerminal: { id: 'default-term', cwd: '/repo', alive: true },
      deskBasePath: '/desk',
    });

    expect(choice).toEqual({
      kind: 'connect',
      terminal: { id: 'ai-term', title: 'Tests', cwd: '/repo', alive: true },
    });
  });

  it('没有 AI 活跃终端时复用当前会话默认底部终端', () => {
    const choice = chooseInlineTerminal({
      session: { path: '/session/a.jsonl', cwd: '/repo' },
      activeTerminal: null,
      defaultTerminal: { id: 'default-term', title: 'repo', cwd: '/repo', alive: true },
      deskBasePath: '/desk',
    });

    expect(choice).toEqual({
      kind: 'connect',
      terminal: { id: 'default-term', title: 'repo', cwd: '/repo', alive: true },
    });
  });

  it('默认终端已结束时按会话 cwd 新建', () => {
    const choice = chooseInlineTerminal({
      session: { path: '/session/a.jsonl', cwd: '/repo' },
      activeTerminal: null,
      defaultTerminal: { id: 'dead-term', cwd: '/repo', alive: false },
      deskBasePath: '/desk',
    });

    expect(choice).toEqual({ kind: 'create', cwd: '/repo' });
  });

  it('会话没有 cwd 时回退到 deskBasePath', () => {
    const choice = chooseInlineTerminal({
      session: { path: '/session/a.jsonl', cwd: null },
      activeTerminal: null,
      defaultTerminal: null,
      deskBasePath: '/desk',
    });

    expect(choice).toEqual({ kind: 'create', cwd: '/desk' });
  });

  it('没有当前会话时按工作区目录新建', () => {
    const choice = chooseInlineTerminal({
      session: null,
      activeTerminal: null,
      defaultTerminal: null,
      deskBasePath: '/desk',
    });

    expect(choice).toEqual({ kind: 'create', cwd: '/desk' });
  });
});
