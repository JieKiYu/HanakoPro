export type ErrorSeverityValue = "critical" | "degraded" | "cosmetic";
export type ErrorCategoryValue = "network" | "llm" | "filesystem" | "ipc" | "render" | "bridge" | "config" | "auth" | "unknown";

export const ErrorSeverity: Readonly<Record<string, ErrorSeverityValue>>;
export const ErrorCategory: Readonly<Record<string, ErrorCategoryValue>>;
export const ERROR_DEFS: Readonly<Record<string, {
  severity: ErrorSeverityValue;
  category: ErrorCategoryValue;
  i18nKey: string;
  retryable: boolean;
  httpStatus?: number;
}>>;

export class AppError extends Error {
  code: string;
  severity: ErrorSeverityValue;
  category: ErrorCategoryValue;
  retryable: boolean;
  userMessageKey: string;
  httpStatus: number;
  context: Record<string, unknown>;
  traceId: string;

  constructor(code: string, opts?: {
    message?: string;
    context?: Record<string, unknown>;
    traceId?: string;
    cause?: unknown;
  });

  toJSON(): { code: string; message: string; context: Record<string, unknown>; traceId: string };
  static fromJSON(data: { code?: string; message?: string; context?: Record<string, unknown>; traceId?: string }): AppError;
  static wrap(err: unknown, fallbackCode?: string): AppError;
}
