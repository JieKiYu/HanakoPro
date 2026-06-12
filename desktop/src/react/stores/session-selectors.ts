import type { StoreState } from './index';
type SelectionState = Pick<StoreState, 'selectedIdsBySession'>;
type StreamingState = Pick<StoreState, 'streamingSessions'>;
type TerminalSessionState = Pick<StoreState, 'chatSessions'>;
type ActiveTerminalSessionState = TerminalSessionState & StreamingState;

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

function recordField(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function terminalCandidateFromTool(tool: unknown): LatestTerminalSession | null {
  const record = recordField(tool);
  const name = stringField(record?.name);
  if (!name?.startsWith('terminal_')) return null;
  const details = recordField(record?.details);
  const args = recordField(record?.args);
  const id = stringField(details?.id) ?? stringField(args?.id);
  if (!id) return null;
  return {
    id,
    title: stringField(details?.title),
    cwd: stringField(details?.cwd),
    alive: booleanField(details?.alive),
    running: record?.done !== true,
  };
}

export function selectLatestTerminalSession(
  state: TerminalSessionState,
  sessionPath: string | null | undefined,
): LatestTerminalSession | null {
  if (!sessionPath) return null;
  const session = state.chatSessions[sessionPath];
  if (!Array.isArray(session?.items) || session.items.length === 0) return null;

  const byNewestId = new Map<string, LatestTerminalSession>();
  for (let i = session.items.length - 1; i >= 0; i -= 1) {
    const item = session.items[i];
    if (item?.type !== 'message' || item.data?.role !== 'assistant') continue;
    const blocks = Array.isArray(item.data.blocks) ? item.data.blocks : [];
    for (let b = blocks.length - 1; b >= 0; b -= 1) {
      const block = blocks[b];
      const blockRecord = recordField(block);
      if (blockRecord?.type !== 'tool_group') continue;
      const tools = Array.isArray(blockRecord.tools) ? blockRecord.tools : [];
      for (let t = tools.length - 1; t >= 0; t -= 1) {
        const candidate = terminalCandidateFromTool(tools[t]);
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
  return candidates.find((candidate) => candidate.running || candidate.alive === true) ?? null;
}

export function selectLatestActiveTerminalSession(
  state: ActiveTerminalSessionState,
  sessionPath: string | null | undefined,
): LatestTerminalSession | null {
  if (!selectIsStreamingSession(state, sessionPath)) return null;
  return selectLatestTerminalSession(state, sessionPath);
}
