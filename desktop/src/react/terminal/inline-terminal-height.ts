export const INLINE_TERMINAL_DEFAULT_HEIGHT = 330;
export const INLINE_TERMINAL_MIN_HEIGHT = 180;
export const INLINE_TERMINAL_MAX_VIEWPORT_RATIO = 0.72;
export const INLINE_TERMINAL_MIN_CONTENT_HEIGHT = 220;

export function inlineTerminalMaxHeight(viewportHeight: number): number {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : 900;
  const ratioMax = Math.round(height * INLINE_TERMINAL_MAX_VIEWPORT_RATIO);
  const contentMax = Math.round(height - INLINE_TERMINAL_MIN_CONTENT_HEIGHT);
  return Math.max(INLINE_TERMINAL_MIN_HEIGHT, Math.min(ratioMax, contentMax));
}

export function clampInlineTerminalHeight(height: number, viewportHeight: number): number {
  const normalized = Number.isFinite(height) ? Math.round(height) : INLINE_TERMINAL_DEFAULT_HEIGHT;
  return Math.max(
    INLINE_TERMINAL_MIN_HEIGHT,
    Math.min(inlineTerminalMaxHeight(viewportHeight), normalized),
  );
}

export function heightFromTopResizeDrag(startHeight: number, startY: number, currentY: number, viewportHeight: number): number {
  return clampInlineTerminalHeight(startHeight + startY - currentY, viewportHeight);
}
