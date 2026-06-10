import { describe, expect, it } from 'vitest';
import { buildGoalPromptMessage } from '../../components/input/goal-message';

describe('goal prompt message', () => {
  it('uses the objective itself for both model input and visible user text', () => {
    const message = buildGoalPromptMessage('  启动守一禅机画布预览。  ');

    expect(message).toEqual({
      promptText: '启动守一禅机画布预览。',
      displayText: '启动守一禅机画布预览。',
    });
    expect(message?.promptText).not.toContain('请把下面内容作为当前对话目标');
  });

  it('does not create an empty goal message', () => {
    expect(buildGoalPromptMessage('   ')).toBeNull();
  });
});
