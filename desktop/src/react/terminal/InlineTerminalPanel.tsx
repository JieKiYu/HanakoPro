import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { TerminalPane, type TerminalThemeTokens } from './TerminalPane';
import { useStore } from '../stores';
import { selectLatestActiveTerminalSession } from '../stores/session-selectors';
import { chooseInlineTerminal } from './inline-terminal-selection';
import { INLINE_TERMINAL_MIN_HEIGHT, heightFromTopResizeDrag, inlineTerminalMaxHeight } from './inline-terminal-height';
import styles from './InlineTerminalPanel.module.css';

const WORKSPACE_TERMINAL_KEY = '__hanako_workspace_terminal__';

interface TerminalMeta {
  id: string;
  title?: string;
  cwd?: string;
  alive?: boolean;
}

interface ServerInfo {
  port: string;
  token: string;
}

interface ResizeDragState {
  startHeight: number;
  startY: number;
}

const RESIZING_BODY_CLASS = 'inline-terminal-resizing';

function baseName(path: string | undefined): string {
  if (!path) return '';
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function terminalTitle(meta: TerminalMeta | null, cwd: string | undefined): string {
  if (meta?.title) return meta.title;
  const folder = baseName(meta?.cwd || cwd);
  return folder ? `终端 · ${folder}` : '终端';
}

function displayCwd(meta: TerminalMeta | null, fallback: string | undefined): string {
  return meta?.cwd || fallback || '';
}

function terminalMap(items: TerminalMeta[] | undefined): Map<string, TerminalMeta> {
  const next = new Map<string, TerminalMeta>();
  for (const item of items ?? []) {
    if (item?.id) next.set(item.id, item);
  }
  return next;
}

function resolveCssColor(host: HTMLElement, value: string, fallback: string, property: 'color' | 'backgroundColor' = 'color'): string {
  const raw = value.trim() || fallback;
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.overflow = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style[property] = raw;
  host.appendChild(probe);
  const computed = getComputedStyle(probe)[property].trim();
  probe.remove();
  return computed || fallback;
}

function isUsableTerminal(meta: TerminalMeta | null | undefined): meta is TerminalMeta {
  return !!meta?.id && meta.alive !== false;
}

function sameTerminal(a: TerminalMeta | null, b: TerminalMeta): boolean {
  return !!a
    && a.id === b.id
    && a.title === b.title
    && a.cwd === b.cwd
    && a.alive === b.alive;
}

export function InlineTerminalPanel({ active = true }: { active?: boolean }) {
  const currentSessionPath = useStore(s => s.currentSessionPath);
  const session = useStore(s => s.sessions.find(se => se.path === currentSessionPath) ?? null);
  const deskBasePath = useStore(s => s.deskBasePath);
  const terminalKey = currentSessionPath || WORKSPACE_TERMINAL_KEY;
  const defaultTerminal = useStore(s => s.inlineTerminalBySession[terminalKey] ?? null);
  const locale = useStore(s => s.locale);
  const activeTerminal = useStore(s => (
    active ? selectLatestActiveTerminalSession(s, s.currentSessionPath) : null
  ));
  const inlineTerminalHeight = useStore(s => s.inlineTerminalHeight);
  const setInlineTerminalForSession = useStore(s => s.setInlineTerminalForSession);
  const setInlineTerminalOpen = useStore(s => s.setInlineTerminalOpen);
  const setInlineTerminalHeight = useStore(s => s.setInlineTerminalHeight);

  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [currentTerminal, setCurrentTerminal] = useState<TerminalMeta | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themeTokens, setThemeTokens] = useState<TerminalThemeTokens | null>(null);
  const [missingTerminalIds, setMissingTerminalIds] = useState<Set<string>>(() => new Set());
  const [serverTerminals, setServerTerminals] = useState<Map<string, TerminalMeta> | null>(null);
  const [resizing, setResizing] = useState(false);
  const creatingForRef = useRef<string | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const pendingResizeYRef = useRef<number | null>(null);
  const lastResizeHeightRef = useRef<number | null>(null);

  const effectiveActiveTerminal = useMemo(() => {
    if (!activeTerminal || !serverTerminals || missingTerminalIds.has(activeTerminal.id)) return null;
    const live = serverTerminals.get(activeTerminal.id);
    if (!live || live.alive === false) return null;
    return { ...activeTerminal, ...live };
  }, [activeTerminal, missingTerminalIds, serverTerminals]);
  const effectiveDefaultTerminal = useMemo(() => {
    if (!defaultTerminal || !serverTerminals || missingTerminalIds.has(defaultTerminal.id)) return null;
    const live = serverTerminals.get(defaultTerminal.id);
    if (!live || live.alive === false) return null;
    return { ...defaultTerminal, ...live };
  }, [defaultTerminal, missingTerminalIds, serverTerminals]);

  const choice = useMemo(() => {
    if (!active) return { kind: 'idle' as const };
    return chooseInlineTerminal({
      session: session ? { path: session.path, cwd: session.cwd } : null,
      activeTerminal: effectiveActiveTerminal,
      defaultTerminal: effectiveDefaultTerminal,
      deskBasePath,
    });
  }, [active, effectiveActiveTerminal, effectiveDefaultTerminal, deskBasePath, session, serverTerminals]);
  const connectTerminal = choice.kind === 'connect' ? choice.terminal ?? null : null;
  const createCwd = serverTerminals && choice.kind === 'create' ? choice.cwd ?? '' : null;

  const adoptTerminal = useCallback((meta: TerminalMeta, opts: { rememberDefault?: boolean } = {}) => {
    setCurrentTerminal(curr => sameTerminal(curr, meta) ? curr : meta);
    if (opts.rememberDefault) {
      setInlineTerminalForSession(terminalKey, {
        id: meta.id,
        title: meta.title,
        cwd: meta.cwd,
        alive: meta.alive,
      });
    }
  }, [setInlineTerminalForSession, terminalKey]);

  const applyResizeFromY = useCallback((clientY: number) => {
    const drag = resizeDragRef.current;
    if (!drag) return;
    const viewportHeight = window.innerHeight;
    const nextHeight = heightFromTopResizeDrag(drag.startHeight, drag.startY, clientY, viewportHeight);
    if (nextHeight === lastResizeHeightRef.current) return;
    lastResizeHeightRef.current = nextHeight;
    setInlineTerminalHeight(nextHeight, viewportHeight);
  }, [setInlineTerminalHeight]);

  const flushPendingResize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    const clientY = pendingResizeYRef.current;
    pendingResizeYRef.current = null;
    if (clientY !== null) applyResizeFromY(clientY);
  }, [applyResizeFromY]);

  const scheduleResizeFromY = useCallback((clientY: number) => {
    pendingResizeYRef.current = clientY;
    if (resizeFrameRef.current !== null) return;
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      const pendingY = pendingResizeYRef.current;
      pendingResizeYRef.current = null;
      if (pendingY !== null) applyResizeFromY(pendingY);
    });
  }, [applyResizeFromY]);

  const stopResize = useCallback(() => {
    flushPendingResize();
    resizeDragRef.current = null;
    lastResizeHeightRef.current = null;
    setResizing(false);
    document.body.classList.remove(RESIZING_BODY_CLASS);
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }, [flushPendingResize]);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizeDragRef.current = {
      startHeight: useStore.getState().inlineTerminalHeight,
      startY: event.clientY,
    };
    lastResizeHeightRef.current = resizeDragRef.current.startHeight;
    setResizing(true);
    document.body.classList.add(RESIZING_BODY_CLASS);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  }, []);

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = useStore.getState().inlineTerminalHeight;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const step = event.shiftKey ? 80 : 24;
    let next: number | null = null;
    if (event.key === 'ArrowUp') next = current + step;
    if (event.key === 'ArrowDown') next = current - step;
    if (event.key === 'PageUp') next = current + 80;
    if (event.key === 'PageDown') next = current - 80;
    if (event.key === 'Home') next = INLINE_TERMINAL_MIN_HEIGHT;
    if (event.key === 'End') next = inlineTerminalMaxHeight(viewportHeight);
    if (next == null) return;
    event.preventDefault();
    setInlineTerminalHeight(next, viewportHeight);
  }, [setInlineTerminalHeight]);

  useEffect(() => {
    if (!resizing) return;
    const onPointerMove = (event: PointerEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      scheduleResizeFromY(event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      pendingResizeYRef.current = event.clientY;
      stopResize();
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      stopResize();
    };
  }, [resizing, setInlineTerminalHeight, stopResize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const port = String(await window.platform?.getServerPort?.() ?? '');
        const token = String(await window.platform?.getServerToken?.() ?? '');
        if (!cancelled) setServerInfo(port ? { port, token } : null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '无法获取 server 信息');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!serverInfo) {
      setServerTerminals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${serverInfo.port}/api/terminal/list`, {
          headers: { Authorization: `Bearer ${serverInfo.token}` },
        });
        const data: { terminals?: TerminalMeta[] } = await res.json();
        if (!cancelled) {
          const next = terminalMap(Array.isArray(data.terminals) ? data.terminals : []);
          setServerTerminals(next);
          setCurrentTerminal(curr => {
            if (!curr) return curr;
            const live = next.get(curr.id);
            return live && live.alive !== false ? { ...curr, ...live } : null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setServerTerminals(new Map());
          setError(err instanceof Error ? err.message : '无法读取终端列表');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [active, serverInfo]);

  useEffect(() => {
    const syncTheme = () => {
      const root = document.documentElement;
      const panel = document.querySelector(`.${styles.panel}`) as HTMLElement | null;
      const stylesFor = getComputedStyle(panel ?? root);
      const rootStyles = getComputedStyle(root);
      const read = (name: string, fallback: string) =>
        (stylesFor.getPropertyValue(name).trim() || rootStyles.getPropertyValue(name).trim() || fallback);
      const colorHost = panel ?? root;
      setThemeTokens({
        background: resolveCssColor(colorHost, read('--inline-terminal-bg', read('--bg-card', '#1e1e1e')), '#1e1e1e', 'backgroundColor'),
        foreground: resolveCssColor(colorHost, read('--inline-terminal-fg', read('--text', '#d4d4d4')), '#d4d4d4'),
        cursor: resolveCssColor(colorHost, read('--accent', '#537d96'), '#537d96'),
        selectionBackground: resolveCssColor(colorHost, read('--inline-terminal-selection', 'rgba(83, 125, 150, 0.22)'), 'rgba(83, 125, 150, 0.22)', 'backgroundColor'),
      });
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const timer = window.setTimeout(syncTheme, 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [locale]);

  useEffect(() => {
    if (!active || !serverInfo) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${serverInfo.port}/api/terminal/events?token=${encodeURIComponent(serverInfo.token)}`);
      ws.onmessage = (event) => {
        let msg: { type?: string; terminal?: TerminalMeta; terminals?: TerminalMeta[]; id?: string };
        try { msg = JSON.parse(typeof event.data === 'string' ? event.data : ''); } catch { return; }
        if (cancelled || !msg) return;
        if (msg.type === 'snapshot' && Array.isArray(msg.terminals)) {
          const nextMap = terminalMap(msg.terminals);
          setServerTerminals(nextMap);
          setMissingTerminalIds(prev => {
            if (prev.size === 0) return prev;
            const liveIds = new Set(nextMap.keys());
            const next = new Set([...prev].filter(id => !liveIds.has(id)));
            return next.size === prev.size ? prev : next;
          });
          setCurrentTerminal(curr => {
            if (!curr) return curr;
            const live = nextMap.get(curr.id);
            return live && live.alive !== false ? { ...curr, ...live } : null;
          });
        } else if (msg.type === 'created' && msg.terminal?.id) {
          const terminal = msg.terminal;
          setServerTerminals(prev => {
            const next = new Map(prev ?? []);
            next.set(terminal.id, terminal);
            return next;
          });
          setMissingTerminalIds(prev => {
            if (!prev.has(terminal.id)) return prev;
            const next = new Set(prev);
            next.delete(terminal.id);
            return next;
          });
          setCurrentTerminal(curr => curr?.id === terminal.id ? { ...curr, ...terminal } : curr);
        } else if (msg.type === 'exited' && typeof msg.id === 'string') {
          const exitedId = msg.id;
          setServerTerminals(prev => {
            const next = new Map(prev ?? []);
            const existing = next.get(exitedId);
            if (existing) next.set(exitedId, { ...existing, alive: false });
            return next;
          });
          setCurrentTerminal(curr => curr?.id === exitedId ? { ...curr, alive: false } : curr);
          if (defaultTerminal?.id === msg.id) {
            setInlineTerminalForSession(terminalKey, { ...defaultTerminal, alive: false });
          }
        }
      };
    } catch {
      // 非关键路径；TerminalPane 自己仍会连接具体会话。
    }
    return () => {
      cancelled = true;
      try { ws?.close(); } catch {}
    };
  }, [active, defaultTerminal, serverInfo, setInlineTerminalForSession, terminalKey]);

  useEffect(() => {
    if (!active) return;
    if (connectTerminal) {
      adoptTerminal(connectTerminal);
    } else {
      setCurrentTerminal(null);
    }
  }, [active, adoptTerminal, connectTerminal, terminalKey]);

  useEffect(() => {
    if (!active || createCwd === null || !serverInfo) return;

    const createKey = `${terminalKey}\n${createCwd}`;
    if (creatingForRef.current === createKey) return;
    creatingForRef.current = createKey;
    setCreatingFor(createKey);
    setError(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${serverInfo.port}/api/terminal/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverInfo.token}`,
          },
          body: JSON.stringify({
            cwd: createCwd || undefined,
            cols: 100,
            rows: 24,
            title: createCwd ? baseName(createCwd) || createCwd : undefined,
          }),
        });
        const data: TerminalMeta & { ok?: boolean; error?: string } = await res.json();
        if (!res.ok || !data.ok || !data.id) throw new Error(data.error || 'create failed');
        if (!cancelled) {
          setServerTerminals(prev => {
            const next = new Map(prev ?? []);
            next.set(data.id, data);
            return next;
          });
          adoptTerminal(data, { rememberDefault: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '创建终端失败');
      } finally {
        if (creatingForRef.current === createKey) creatingForRef.current = null;
        if (!cancelled) setCreatingFor(null);
      }
    })();

    return () => { cancelled = true; };
  }, [active, adoptTerminal, createCwd, serverInfo, terminalKey]);

  const cwd = displayCwd(currentTerminal, session?.cwd || deskBasePath || undefined);
  const title = terminalTitle(currentTerminal, cwd);
  const status = !serverInfo
    ? '连接中'
    : creatingFor
      ? '创建中'
      : currentTerminal?.alive === false
        ? '已结束'
        : isUsableTerminal(currentTerminal)
          ? '运行中'
          : '待连接';

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const resizeMax = inlineTerminalMaxHeight(viewportHeight);

  return (
    <section className={`${styles.panel}${resizing ? ` ${styles.resizing}` : ''}`} aria-label="内嵌终端" data-active={active ? 'true' : 'false'}>
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-label="调整终端高度"
        aria-orientation="horizontal"
        aria-valuemin={INLINE_TERMINAL_MIN_HEIGHT}
        aria-valuemax={resizeMax}
        aria-valuenow={inlineTerminalHeight}
        tabIndex={active ? 0 : -1}
        title="拖动调整终端高度"
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
      />
      <div className={styles.header}>
        <span className={styles.mark} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
            <polyline points="7 9 10 12 7 15" />
            <line x1="13" y1="15" x2="17" y2="15" />
          </svg>
        </span>
        <div className={styles.titleGroup}>
          <div className={styles.title} title={title}>{title}</div>
          <div className={styles.cwd} title={cwd}>{cwd || '等待会话目录'}</div>
        </div>
        <span className={styles.status}>{status}</span>
        <button className={styles.close} type="button" title="收起终端" onClick={() => setInlineTerminalOpen(false)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles.body}>
        {!active ? (
          <div className={styles.empty}>终端已收起</div>
        ) : error ? (
          <div className={`${styles.empty} ${styles.error}`}>{error}</div>
        ) : isUsableTerminal(currentTerminal) && serverInfo ? (
          <div className={styles.terminalHost}>
            <TerminalPane
              termId={currentTerminal.id}
              serverPort={serverInfo.port}
              serverToken={serverInfo.token}
              themeTokens={themeTokens ?? undefined}
              variant="inline"
              onMissing={() => {
                setMissingTerminalIds(prev => {
                  if (prev.has(currentTerminal.id)) return prev;
                  const next = new Set(prev);
                  next.add(currentTerminal.id);
                  return next;
                });
                setCurrentTerminal(curr => curr?.id === currentTerminal.id ? null : curr);
                if (defaultTerminal?.id === currentTerminal.id) {
                  setInlineTerminalForSession(terminalKey, null);
                }
              }}
              onExit={() => {
                setCurrentTerminal(curr => curr?.id === currentTerminal.id ? { ...curr, alive: false } : curr);
                if (defaultTerminal?.id === currentTerminal.id) {
                  setInlineTerminalForSession(terminalKey, { ...defaultTerminal, alive: false });
                }
              }}
            />
          </div>
        ) : (
          <div className={styles.empty}>{serverInfo ? '正在准备终端…' : '正在连接本地服务…'}</div>
        )}
      </div>
    </section>
  );
}
