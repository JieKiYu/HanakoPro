import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function cssBlock(css: string, selector: string): string {
  return css.match(new RegExp(`${selector}\\s*\\{(?<body>[^}]*)\\}`))?.groups?.body || '';
}

describe('MessageActions layout', () => {
  it('anchors the select checkbox group to the lower right of the message block', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );
    const block = cssBlock(css, String.raw`\.msgActions`);

    expect(block).toMatch(/bottom:\s*4px/);
    expect(block).toMatch(/right:\s*4px/);
    expect(block).not.toMatch(/top:\s*4px/);
  });

  it('keeps active message action styling when the button is hovered', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );
    const block = cssBlock(css, String.raw`\.msgActionBtnActive:hover`);

    expect(block).toMatch(/color:\s*var\(--accent\)\s*!important/);
    expect(block).toMatch(/background:\s*rgba\(var\(--accent-rgb\),\s*0\.16\)/);
  });

  it('renders file output cards as block-level rows instead of inline siblings', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );
    const block = cssBlock(css, String.raw`\.fileOutputCard`);

    expect(block).toMatch(/display:\s*flex/);
    expect(block).not.toMatch(/display:\s*inline-flex/);
  });

  it('keeps assistant footer controls on the same vertical rhythm as tool calls', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );

    const toolGroup = cssBlock(css, String.raw`\.toolGroup`);
    const conclusion = cssBlock(css, String.raw`\.goalAcceptanceConclusion`);
    const browserRow = cssBlock(css, String.raw`\.assistantBrowserRow`);
    const revertRow = cssBlock(css, String.raw`\.assistantRevertRow`);

    expect(toolGroup).toMatch(/margin:\s*var\(--space-xs\)\s+0/);
    expect(conclusion).toMatch(/margin:\s*var\(--space-xs\)\s+0/);
    expect(browserRow).toMatch(/margin:\s*var\(--space-xs\)\s+0/);
    expect(revertRow).toMatch(/margin:\s*var\(--space-xs\)\s+0/);
  });
});
