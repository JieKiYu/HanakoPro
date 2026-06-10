import type { ContentBlock } from '../stores/chat-types';

export type GoalConclusionBlock = Extract<ContentBlock, { type: 'goal_acceptance_conclusion' }>;

export function normalizeGoalConclusionText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isDuplicateGoalConclusionTextBlock(
  block: ContentBlock,
  conclusions: GoalConclusionBlock[],
): boolean {
  if (block.type !== 'text' || conclusions.length === 0) return false;
  const text = normalizeGoalConclusionText(block.source || block.html || '');
  if (!text.startsWith('验真已合')) return false;
  // Once a goal conclusion card exists in this turn, the visible conclusion lives
  // in that card. A following plain paragraph that starts with the same ritual
  // conclusion prefix is the tool result/final-answer echo, even when punctuation
  // or spacing differs slightly from the card evidence.
  return true;
}
