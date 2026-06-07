import type { StoreState } from './index';
import type { ToolCall } from './chat-types';

type SelectionState = Pick<StoreState, 'selectedIdsBySession'>;
type StreamingState = Pick<StoreState, 'streamingSessions'>;
type TerminalSessionState = Pick<StoreState, 'chatSessions'>;

export const EMPTY_SELECTED_IDS = Object.freeze([]) as readonly string[];

export interface LatestTerminalSession {
  id: string;
  title?: string;
  cwd?: string;
  alive?: boolean;
  running: boolean;
}

export function selectSelectedIdsBySession(
  state: SelectionState,
  sessionPath: string | null | undefined,
): readonly string[] {
  if (!sessionPath) return EMPTY_SELECTED_IDS;
  return state.selectedIdsBySession[sessionPath] ?? EMPTY_SELECTED_IDS;
}

export function selectIsStreamingSession(
  state: StreamingState,
  sessionPath: string | null | undefined,
): boolean {
  return !!sessionPath && state.streamingSessions.includes(sessionPath);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function terminalCandidateFromTool(tool: ToolCall): LatestTerminalSession | null {
  if (!tool.name.startsWith('terminal_')) return null;
  const details = tool.details as Record<string, unknown> | undefined;
  const args = tool.args as Record<string, unknown> | undefined;
  const id = stringField(details?.id) ?? stringField(args?.id);
  if (!id) return null;
  return {
    id,
    title: stringField(details?.title),
    cwd: stringField(details?.cwd),
    alive: booleanField(details?.alive),
    running: !tool.done,
  };
}

export function selectLatestTerminalSession(
  state: TerminalSessionState,
  sessionPath: string | null | undefined,
): LatestTerminalSession | null {
  if (!sessionPath) return null;
  const session = state.chatSessions[sessionPath];
  if (!session?.items?.length) return null;

  const byNewestId = new Map<string, LatestTerminalSession>();
  for (let i = session.items.length - 1; i >= 0; i -= 1) {
    const item = session.items[i];
    if (item.type !== 'message' || item.data.role !== 'assistant') continue;
    const blocks = item.data.blocks || [];
    for (let b = blocks.length - 1; b >= 0; b -= 1) {
      const block = blocks[b];
      if (block.type !== 'tool_group') continue;
      for (let t = block.tools.length - 1; t >= 0; t -= 1) {
        const candidate = terminalCandidateFromTool(block.tools[t]);
        if (!candidate) continue;
        const existing = byNewestId.get(candidate.id);
        if (!existing) {
          byNewestId.set(candidate.id, candidate);
        } else {
          byNewestId.set(candidate.id, {
            ...existing,
            title: existing.title ?? candidate.title,
            cwd: existing.cwd ?? candidate.cwd,
            alive: existing.alive ?? candidate.alive,
            running: existing.running || candidate.running,
          });
        }
      }
    }
  }

  const candidates = [...byNewestId.values()];
  return candidates.find((candidate) => candidate.running || candidate.alive !== false) ?? candidates[0] ?? null;
}
