export interface GoalPromptMessage {
  promptText: string;
  displayText: string;
}

export function buildGoalPromptMessage(objective: string): GoalPromptMessage | null {
  const text = typeof objective === 'string' ? objective.trim() : '';
  if (!text) return null;
  return {
    promptText: text,
    displayText: text,
  };
}
