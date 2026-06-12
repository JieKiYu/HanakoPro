import type { InlineTerminalRecord } from '../stores/ui-slice';
import type { LatestTerminalSession } from '../stores/session-selectors';

export interface InlineTerminalSessionInfo {
  path: string | null;
  cwd?: string | null;
}

export interface InlineTerminalChoice {
  kind: 'connect' | 'create' | 'idle';
  terminal?: InlineTerminalRecord;
  cwd?: string;
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

export function chooseInlineTerminal({
  session,
  activeTerminal,
  defaultTerminal,
  deskBasePath,
}: {
  session: InlineTerminalSessionInfo | null | undefined;
  activeTerminal: LatestTerminalSession | null | undefined;
  defaultTerminal: InlineTerminalRecord | null | undefined;
  deskBasePath: string | null | undefined;
}): InlineTerminalChoice {
  if (activeTerminal && (activeTerminal.running || activeTerminal.alive !== false)) {
    return {
      kind: 'connect',
      terminal: {
        id: activeTerminal.id,
        title: activeTerminal.title,
        cwd: activeTerminal.cwd,
        alive: activeTerminal.alive,
      },
    };
  }

  if (defaultTerminal && defaultTerminal.alive !== false) {
    return { kind: 'connect', terminal: defaultTerminal };
  }

  return {
    kind: 'create',
    cwd: nonEmpty(session?.cwd) ?? nonEmpty(deskBasePath) ?? '',
  };
}
