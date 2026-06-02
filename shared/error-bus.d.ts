import { AppError } from "./errors.js";

export type ErrorRoute = "toast" | "statusbar" | "boundary" | "silent";

export class ErrorBus {
  addBreadcrumb(crumb: Record<string, unknown>): void;
  report(error: unknown, extra?: unknown): void;
  subscribe(listener: (entry: { error: AppError; timestamp: number; breadcrumbs: unknown[] }, route: ErrorRoute) => void): () => void;
}

export const errorBus: ErrorBus;
