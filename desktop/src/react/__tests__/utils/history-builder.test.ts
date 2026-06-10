import { describe, expect, it } from 'vitest';
import { buildItemsFromHistory } from '../../utils/history-builder';

describe('buildItemsFromHistory user image restoration', () => {
  it('把上下文压缩 marker 插入消息列表', () => {
    const items = buildItemsFromHistory({
      messages: [
        { id: '0', role: 'user', content: 'before' },
        { id: '1', role: 'assistant', content: 'after' },
      ],
      compactions: [{
        id: 'c1',
        label: '上下文已自动压缩',
        afterMessageId: '0',
      }],
    });

    expect(items.map(item => item.type)).toEqual(['message', 'compaction', 'message']);
    const marker = items[1];
    expect(marker.type).toBe('compaction');
    if (marker.type !== 'compaction') throw new Error('expected compaction');
    expect(marker.yuan).toBe('上下文已自动压缩');
    expect(marker.afterMessageId).toBe('0');
  });

  it('把服务端 ISO timestamp 归一成前端毫秒时间', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'u1',
        role: 'user',
        content: 'hello',
        timestamp: '2026-05-07T05:42:00.000Z',
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.timestamp).toBe(Date.parse('2026-05-07T05:42:00.000Z'));
  });

  it('保留后端 session entry id 作为分支操作来源', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: '0',
        entryId: 'entry-user-1',
        role: 'user',
        content: 'hello',
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.id).toBe('0');
    expect(first.data.sourceEntryId).toBe('entry-user-1');
  });

  it('保留加密 reasoning 的空 thinking 完成块', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'a1',
        role: 'assistant',
        content: '<mood>\nVibe: 静\n</mood>\n\n正文',
        hasThinking: true,
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.blocks?.[0]).toEqual({ type: 'thinking', content: '', sealed: true });
    expect(first.data.blocks?.map(block => block.type)).toEqual(['thinking', 'mood', 'text']);
  });

  it('把同一轮最终回复里的 mood 提到工具卡前面', () => {
    const items = buildItemsFromHistory({
      messages: [
        { id: 'u1', role: 'user', content: '打开网页' },
        {
          id: 'a-tool',
          role: 'assistant',
          content: '',
          hasThinking: true,
          toolCalls: [{ name: 'browser', args: { action: 'start' }, done: true, success: true }],
        },
        {
          id: 'a-final',
          role: 'assistant',
          content: '<mood>\n气：稳。\n</mood>\n\n已打开页面。',
        },
      ],
    });

    const firstAssistant = items[1];
    const finalAssistant = items[2];
    expect(firstAssistant.type).toBe('message');
    expect(finalAssistant.type).toBe('message');
    if (firstAssistant.type !== 'message' || finalAssistant.type !== 'message') {
      throw new Error('expected assistant messages');
    }
    expect(firstAssistant.data.blocks?.map(block => block.type)).toEqual(['thinking', 'mood', 'tool_group']);
    expect(finalAssistant.data.blocks?.map(block => block.type)).toEqual(['text']);
  });

  it('从历史 session_goal complete 工具结果恢复独立验真结论块', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'a-goal',
        role: 'assistant',
        content: '',
        toolCalls: [{
          name: 'session_goal',
          args: { action: 'complete' },
          done: true,
          success: true,
          details: {
            action: 'complete',
            summary: '验真已合：已复走预览入口，确认页面可见，目标收束。\n目标用量：39187 tokens，用时约 1分 58 秒。',
            metrics: { tokenUsage: 39187, elapsedMs: 118000 },
          },
        }],
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.blocks?.map(block => block.type)).toEqual(['tool_group', 'goal_acceptance_conclusion']);
    expect(first.data.blocks?.[1]).toEqual({
      type: 'goal_acceptance_conclusion',
      evidence: '验真已合：已复走预览入口，确认页面可见，目标收束。',
      usage: '目标用量：39187 tokens，用时约 1分 58 秒。',
    });
  });

  it('从历史恢复验真开场时放在验收工具组前', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'a-review',
        role: 'assistant',
        content: '',
        hasThinking: true,
        toolCalls: [{
          name: 'computer',
          args: { action: 'get_app_state' },
          done: true,
          success: true,
        }],
      }],
      blocks: [{
        afterIndex: 0,
        type: 'goal_acceptance',
        title: '验真',
        objective: '启动守一禅机画布预览.',
        text: '这次要验的是：启动守一禅机画布预览.\n我会从真实运行的那条路进去。',
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.blocks?.map(block => block.type)).toEqual(['thinking', 'goal_acceptance', 'tool_group']);
    expect(first.data.blocks?.[1]).toEqual({
      type: 'goal_acceptance',
      title: '验真',
      objective: '启动守一禅机画布预览.',
      text: '这次要验的是：启动守一禅机画布预览.\n我会从真实运行的那条路进去。',
    });
  });

  it('从历史重建时隐藏验真卡片后的跨消息重复结论文本', () => {
    const items = buildItemsFromHistory({
      messages: [
        { id: 'u1', role: 'user', content: '跑目标验收' },
        {
          id: 'a-goal',
          role: 'assistant',
          content: '',
          toolCalls: [{
            name: 'session_goal',
            args: { action: 'complete' },
            done: true,
            success: true,
            details: {
              action: 'complete',
              summary: '验真已合：已用 Hanako 内置浏览器打开本地预览并绑定 Browser 窗口可见检查，页面显示守一缝机诊断画布、Online 状态、6 板块/18 明细图/146 事件，且点击图表区域可响应。\n目标用量：37171 tokens，用时约 2分 55 秒。',
              metrics: { tokenUsage: 37171, elapsedMs: 175000 },
            },
          }],
        },
        {
          id: 'a-duplicate',
          role: 'assistant',
          content: '验真已合：已用 Hanako 内置浏览器打开本地预览并绑定 Browser 窗口可见检查，页面显示守一缝机诊断画布、Online 状态、6 板块 / 18 明细图 / 146 事件，且点击图表区域可响应。',
        },
      ],
    });

    expect(items.map(item => item.type === 'message' ? item.data.id : item.id)).toEqual(['u1', 'a-goal']);
    const goalItem = items[1];
    expect(goalItem.type).toBe('message');
    if (goalItem.type !== 'message') throw new Error('expected message');
    expect(goalItem.data.blocks?.map(block => block.type)).toEqual(['tool_group', 'goal_acceptance_conclusion']);
  });

  it('隐藏 bridge 写入用户消息里的内部时间标签', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'u1',
        role: 'user',
        content: '<t>05-13 05:03</t> hello from phone',
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.text).toBe('hello from phone');
  });

  it('把辅助视觉 attached_image 标记恢复成图片附件，并从正文隐藏', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'u1',
        role: 'user',
        content: '[attached_image: /Users/test/.hanako/attachments/upload-abc.png]\n(看图)',
      }],
    });

    expect(items).toHaveLength(1);
    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.text).toBe('(看图)');
    expect(first.data.textHtml).not.toContain('attached_image');
    expect(first.data.attachments).toEqual([{
      path: '/Users/test/.hanako/attachments/upload-abc.png',
      name: 'upload-abc.png',
      isDir: false,
      visionAuxiliary: true,
    }]);
  });

  it('原生 image block 与 attached_image 路径合并为一个图片附件', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'u1',
        role: 'user',
        content: '[attached_image: /Users/test/.hanako/attachments/upload-native.png]\n看看这个',
        images: [{ data: 'BASE64', mimeType: 'image/png' }],
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.text).toBe('看看这个');
    expect(first.data.attachments).toEqual([{
      path: '/Users/test/.hanako/attachments/upload-native.png',
      name: 'upload-native.png',
      isDir: false,
      mimeType: 'image/png',
      visionAuxiliary: false,
    }]);
  });

  it('把 assistant 原生生成图片恢复成可点击图片块', () => {
    const items = buildItemsFromHistory({
      messages: [{
        id: 'a-img',
        role: 'assistant',
        content: '',
        images: [{ data: 'IMG_BASE64', mimeType: 'image/png' }],
      }],
    });

    const first = items[0];
    expect(first.type).toBe('message');
    if (first.type !== 'message') throw new Error('expected message');
    expect(first.data.blocks).toEqual([
      { type: 'screenshot', base64: 'IMG_BASE64', mimeType: 'image/png' },
    ]);
  });
});
