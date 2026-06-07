export interface AbortLikeError extends Error {
  type: "aborted";
}

export declare function isAbortLikeMessage(message: unknown): boolean;
export declare function isAbortLikeError(err: unknown): boolean;
export declare function createAbortError(message?: string): AbortLikeError;
