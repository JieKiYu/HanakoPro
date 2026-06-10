import type { Session, SessionStream, TodoItem } from '../types';

export type SessionGoalStatus = 'active' | 'paused' | 'complete' | 'blocked';

export interface SessionGoal {
  objective: string;
  status: SessionGoalStatus;
  createdAt: string;
  updatedAt: string;
  elapsedMs?: number;
  metrics?: {
    elapsedMs?: number;
    tokenUsage?: number;
    estimatedTokens?: number;
    contextBaselineTokens?: number;
    contextCurrentTokens?: number;
    tokenUsageSource?: string;
    contextBaselineAt?: string;
    computedAt?: string;
  } | null;
  activeStartedAt?: string | null;
  pausedAt?: string | null;
  completedAt?: string | null;
  blockedAt?: string | null;
  note?: string | null;
}

export interface SessionSlice {
  sessions: Session[];
  currentSessionPath: string | null;
  pendingSessionSwitchPath: string | null;
  sessionStreams: Record<string, SessionStream>;
  pendingNewSession: boolean;
  pendingSessionGoal: SessionGoal | null;
  memoryEnabled: boolean;
  /** @deprecated 兼容层 — 读取当前 session 的 todos，新代码用 todosBySession */
  sessionTodos: TodoItem[];
  todosBySession: Record<string, TodoItem[]>;
  sessionGoalByPath: Record<string, SessionGoal | null>;
  /**
   * 每个 session 的 live todos 版本号。live WS 写入（tool_end）+1，
   * loadMessages hydrate 捕获版本前后对比：若 mid-flight 被 live 更新，
   * 就跳过 hydrate 写入，避免旧快照覆盖更晚到达的实时状态。
   */
  todosLiveVersionBySession: Record<string, number>;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionPath: (path: string | null) => void;
  setPendingSessionSwitchPath: (path: string | null) => void;
  setSessionStream: (sessionPath: string, stream: SessionStream) => void;
  removeSessionStream: (sessionPath: string) => void;
  setPendingNewSession: (pending: boolean) => void;
  setPendingSessionGoal: (goal: SessionGoal | null) => void;
  setMemoryEnabled: (enabled: boolean) => void;
  setSessionTodos: (todos: TodoItem[]) => void;
  setSessionTodosForPath: (sessionPath: string, todos: TodoItem[]) => void;
  setSessionGoalForPath: (sessionPath: string, goal: SessionGoal | null) => void;
  bumpTodosLiveVersion: (sessionPath: string) => void;
}

export const createSessionSlice = (
  set: (partial: Partial<SessionSlice> | ((s: SessionSlice) => Partial<SessionSlice>)) => void
): SessionSlice => ({
  sessions: [],
  currentSessionPath: null,
  pendingSessionSwitchPath: null,
  sessionStreams: {},
  pendingNewSession: false,
  pendingSessionGoal: null,
  memoryEnabled: true,
  sessionTodos: [],
  todosBySession: {},
  sessionGoalByPath: {},
  todosLiveVersionBySession: {},
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionPath: (path) => set({ currentSessionPath: path }),
  setPendingSessionSwitchPath: (path) => set({ pendingSessionSwitchPath: path }),
  setSessionStream: (sessionPath, stream) =>
    set((s) => ({
      sessionStreams: { ...s.sessionStreams, [sessionPath]: stream },
    })),
  removeSessionStream: (sessionPath) =>
    set((s) => {
      const { [sessionPath]: _, ...rest } = s.sessionStreams;
      return { sessionStreams: rest };
    }),
  setPendingNewSession: (pending) => set({ pendingNewSession: pending }),
  setPendingSessionGoal: (goal) => set({ pendingSessionGoal: goal }),
  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
  // 兼容：旧调用方仍可用，写入当前 session
  setSessionTodos: (todos) =>
    set((s) => {
      const path = s.currentSessionPath;
      if (!path) return { sessionTodos: todos };
      return {
        sessionTodos: todos,
        todosBySession: { ...s.todosBySession, [path]: todos },
      };
    }),
  // 新 API：指定 session path
  setSessionTodosForPath: (sessionPath, todos) =>
    set((s) => ({
      todosBySession: { ...s.todosBySession, [sessionPath]: todos },
      // 如果写入的是当前 session，同步更新兼容字段
      sessionTodos: s.currentSessionPath === sessionPath ? todos : s.sessionTodos,
    })),
  setSessionGoalForPath: (sessionPath, goal) =>
    set((s) => ({
      sessionGoalByPath: { ...s.sessionGoalByPath, [sessionPath]: goal },
    })),
  bumpTodosLiveVersion: (sessionPath) =>
    set((s) => ({
      todosLiveVersionBySession: {
        ...s.todosLiveVersionBySession,
        [sessionPath]: (s.todosLiveVersionBySession[sessionPath] ?? 0) + 1,
      },
    })),
});
