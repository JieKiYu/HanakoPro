const ABORT_LIKE_MESSAGE_PATTERNS = [
  /\bthis operation was aborted\b/i,
  /\brequest was aborted\b/i,
  /\boperation aborted\b/i,
  /\bsignal is aborted(?:\s+without reason)?\b/i,
  /\baborted without reason\b/i,
];

export function isAbortLikeMessage(message) {
  if (typeof message !== "string") return false;
  const text = message.trim();
  if (!text) return false;
  return ABORT_LIKE_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isAbortLikeError(err) {
  if (!err) return false;
  if (typeof err === "string") return isAbortLikeMessage(err);
  if (typeof err !== "object") return false;
  return err.name === "AbortError"
    || err.type === "aborted"
    || err.code === "ABORT_ERR"
    || isAbortLikeMessage(err.message)
    || isAbortLikeMessage(err.errorMessage);
}

export function createAbortError(message = "This operation was aborted") {
  const err = new Error(message);
  err.name = "AbortError";
  err.type = "aborted";
  return err;
}
