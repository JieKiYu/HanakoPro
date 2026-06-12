import { describe, expect, it } from 'vitest';
import {
  INLINE_TERMINAL_MIN_HEIGHT,
  clampInlineTerminalHeight,
  heightFromTopResizeDrag,
  inlineTerminalMaxHeight,
} from '../../terminal/inline-terminal-height';

describe('inline terminal height', () => {
  it('increases height when the top edge is dragged upward', () => {
    expect(heightFromTopResizeDrag(330, 500, 420, 900)).toBe(410);
  });

  it('decreases height when the top edge is dragged downward', () => {
    expect(heightFromTopResizeDrag(330, 500, 620, 900)).toBe(210);
  });

  it('clamps to the minimum usable terminal height', () => {
    expect(clampInlineTerminalHeight(40, 900)).toBe(INLINE_TERMINAL_MIN_HEIGHT);
  });

  it('keeps enough room for the main content above the dock', () => {
    const viewport = 900;
    expect(inlineTerminalMaxHeight(viewport)).toBeLessThanOrEqual(viewport - 220);
    expect(clampInlineTerminalHeight(900, viewport)).toBe(inlineTerminalMaxHeight(viewport));
  });
});
