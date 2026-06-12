/**
 * MarkdownContent — 渲染预处理好的 markdown HTML
 *
 * 用 dangerouslySetInnerHTML 设置内容，
 * useEffect 注入代码块复制按钮。
 */

import { memo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { injectCopyButtons } from '../../utils/format';
import { useMermaidDiagrams } from '../../hooks/use-mermaid-diagrams';
import { splitGraphemes } from '../../utils/grapheme';
import { extOfName } from '../../utils/file-kind';
import { openFilePreview } from '../../utils/file-preview';
import { useStore } from '../../stores';
import styles from './Chat.module.css';

interface Props {
  html: string;
  className?: string;
  tailFadeCount?: number;
  sessionPath?: string;
}

const EXPLICIT_PROTOCOL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const ABSOLUTE_WINDOWS_PATH_RE = /^[A-Za-z]:[\\/]/;
const LINE_COLUMN_SUFFIX_RE = /^(.*?)(?::(\d+))(?::(\d+))?$/;

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith('/') || ABSOLUTE_WINDOWS_PATH_RE.test(value);
}

function isFileLikeRelativePath(value: string): boolean {
  if (!value || value.startsWith('#') || value.startsWith('?')) return false;
  if (EXPLICIT_PROTOCOL_RE.test(value) || value.startsWith('//')) return false;
  if (/\s/.test(value)) return false;
  return value.includes('/') && !!extOfName(stripLineColumnSuffix(value).filePath);
}

function normalizeJoinedPath(value: string): string {
  const normalized = normalizePathSeparators(value);
  const prefixMatch = normalized.match(/^(?:[A-Za-z]:|\/)?/);
  const prefix = prefixMatch?.[0] ?? '';
  const rest = normalized.slice(prefix.length);
  const parts: string[] = [];

  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop();
      else if (!prefix) parts.push(part);
      continue;
    }
    parts.push(part);
  }

  if (!prefix) return parts.join('/');
  if (prefix.endsWith('/')) return `${prefix}${parts.join('/')}`;
  return parts.length ? `${prefix}/${parts.join('/')}` : prefix;
}

function stripLineColumnSuffix(raw: string): { filePath: string; line?: number; column?: number } {
  const match = LINE_COLUMN_SUFFIX_RE.exec(raw);
  if (!match) return { filePath: raw };
  const filePath = match[1];
  if (!extOfName(filePath)) return { filePath: raw };
  return {
    filePath,
    line: Number(match[2]),
    column: match[3] ? Number(match[3]) : undefined,
  };
}

function decodeHrefPath(raw: string): string {
  try {
    return decodeURI(raw);
  } catch {
    return raw;
  }
}

function filePathFromFileUrl(rawHref: string): string | null {
  try {
    const parsed = new URL(rawHref);
    if (parsed.protocol !== 'file:') return null;
    return decodeHrefPath(parsed.pathname);
  } catch {
    return null;
  }
}

function sessionBasePath(sessionPath?: string): string | null {
  if (!sessionPath) return null;
  const state = useStore.getState();
  return state.sessions.find(session => session.path === sessionPath)?.cwd || null;
}

function resolveMarkdownLocalHref(rawHref: string, sessionPath?: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const fileUrlPath = filePathFromFileUrl(trimmed);
  if (fileUrlPath) return stripLineColumnSuffix(fileUrlPath).filePath;

  const decoded = decodeHrefPath(trimmed);
  const stripped = stripLineColumnSuffix(decoded);
  if (isAbsoluteLocalPath(stripped.filePath)) return normalizeJoinedPath(stripped.filePath);

  if (!isFileLikeRelativePath(decoded)) return null;

  const basePath = sessionBasePath(sessionPath);
  if (!basePath) return null;
  return normalizeJoinedPath(`${basePath}/${stripped.filePath}`);
}

function handleExternalUrl(rawHref: string): boolean {
  try {
    const parsed = new URL(rawHref);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    window.platform?.openExternal?.(rawHref);
    return true;
  } catch {
    return false;
  }
}

function shouldIgnoreClick(event: MouseEvent<HTMLDivElement>): boolean {
  return event.defaultPrevented || event.button !== 0;
}

function shouldSkipTailFadeNode(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || !!parent.closest('pre, code, table, .katex, .mermaid, svg, button');
}

function clearTailFade(root: HTMLElement): void {
  const tailSpans = Array.from(root.querySelectorAll<HTMLElement>('[data-stream-tail-char="true"]'));
  for (const span of tailSpans) {
    span.replaceWith(document.createTextNode(span.textContent || ''));
  }
  if (tailSpans.length > 0) root.normalize();
}

function applyTailFade(root: HTMLElement, count: number): void {
  clearTailFade(root);
  if (count <= 0) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    if (text.nodeValue && text.nodeValue.trim() && !shouldSkipTailFadeNode(text)) {
      textNodes.push(text);
    }
    current = walker.nextNode();
  }

  const tailNodes: Array<{ node: Text; segments: string[]; take: number }> = [];
  let remaining = count;
  for (let i = textNodes.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const node = textNodes[i];
    const segments = splitGraphemes(node.nodeValue || '');
    if (segments.length === 0) continue;
    const take = Math.min(remaining, segments.length);
    tailNodes.push({ node, segments, take });
    remaining -= take;
  }

  let index = 0;
  for (const item of tailNodes.reverse()) {
    const splitAt = item.segments.length - item.take;
    const before = item.segments.slice(0, splitAt).join('');
    const tail = item.segments.slice(splitAt);
    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    for (const segment of tail) {
      // eslint-disable-next-line no-restricted-syntax -- 流式尾字符是直接挂到 markdown HTML 容器上的，没法用 JSX
      const span = document.createElement('span');
      span.className = styles.streamTailChar;
      span.dataset.streamTailChar = 'true';
      span.style.setProperty('--stream-tail-index', String(index));
      span.textContent = segment;
      fragment.appendChild(span);
      index += 1;
    }
    item.node.parentNode?.replaceChild(fragment, item.node);
  }
}

function enhanceCodeBlockScrollbars(root: HTMLElement): () => void {
  const oldBars = Array.from(root.querySelectorAll<HTMLElement>('[data-md-horizontal-scrollbar="true"]'));
  for (const bar of oldBars) bar.remove();

  const cleanups: Array<() => void> = [];
  const updates: Array<() => void> = [];
  const scrollers = Array.from(root.querySelectorAll<HTMLPreElement>('pre'));

  for (const scroller of scrollers) {
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    track.className = styles.markdownCodeScrollbar;
    track.dataset.mdHorizontalScrollbar = 'true';
    thumb.className = styles.markdownCodeScrollbarThumb;
    track.appendChild(thumb);
    scroller.insertAdjacentElement('afterend', track);

    const update = () => {
      const canScrollX = scroller.scrollWidth > scroller.clientWidth + 1;
      track.hidden = !canScrollX;
      if (!canScrollX) return;
      const trackWidth = track.clientWidth;
      if (trackWidth <= 0) return;
      const thumbWidth = Math.min(trackWidth, Math.max(32, (scroller.clientWidth / scroller.scrollWidth) * trackWidth));
      const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
      const maxScrollLeft = Math.max(1, scroller.scrollWidth - scroller.clientWidth);
      const thumbLeft = (scroller.scrollLeft / maxScrollLeft) * maxThumbLeft;
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.transform = `translateX(${thumbLeft}px)`;
    };
    updates.push(update);

    let dragging: {
      pointerId: number;
      startX: number;
      scrollLeft: number;
      trackWidth: number;
      thumbWidth: number;
    } | null = null;

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || track.hidden) return;
      const rect = track.getBoundingClientRect();
      const thumbWidth = Math.min(rect.width, Math.max(32, (scroller.clientWidth / scroller.scrollWidth) * rect.width));
      const maxThumbLeft = Math.max(1, rect.width - thumbWidth);
      const targetThumbLeft = Math.min(maxThumbLeft, Math.max(0, event.clientX - rect.left - thumbWidth / 2));
      scroller.scrollLeft = (targetThumbLeft / maxThumbLeft) * (scroller.scrollWidth - scroller.clientWidth);
      dragging = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: scroller.scrollLeft,
        trackWidth: rect.width,
        thumbWidth,
      };
      track.setPointerCapture(event.pointerId);
      event.preventDefault();
      update();
    };

    const pointerMove = (event: PointerEvent) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      const maxThumbTravel = Math.max(1, dragging.trackWidth - dragging.thumbWidth);
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      scroller.scrollLeft = dragging.scrollLeft + ((event.clientX - dragging.startX) / maxThumbTravel) * maxScrollLeft;
      event.preventDefault();
      update();
    };

    const pointerEnd = (event: PointerEvent) => {
      if (dragging && dragging.pointerId === event.pointerId && track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
      dragging = null;
    };

    scroller.addEventListener('scroll', update);
    track.addEventListener('pointerdown', pointerDown);
    track.addEventListener('pointermove', pointerMove);
    track.addEventListener('pointerup', pointerEnd);
    track.addEventListener('pointercancel', pointerEnd);
    const frame = window.requestAnimationFrame(update);

    cleanups.push(() => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', update);
      track.removeEventListener('pointerdown', pointerDown);
      track.removeEventListener('pointermove', pointerMove);
      track.removeEventListener('pointerup', pointerEnd);
      track.removeEventListener('pointercancel', pointerEnd);
      track.remove();
    });
  }

  const ResizeObserverCtor = window.ResizeObserver;
  let observer: ResizeObserver | null = null;
  if (ResizeObserverCtor && scrollers.length > 0) {
    observer = new ResizeObserverCtor(() => {
      for (const update of updates) update();
    });
    for (const scroller of scrollers) observer.observe(scroller);
    observer.observe(root);
  }

  return () => {
    observer?.disconnect();
    for (const cleanup of cleanups) cleanup();
  };
}

function enhanceTableCellTooltips(root: HTMLElement): () => void {
  const wrappers = Array.from(root.querySelectorAll<HTMLElement>('.md-table-wrapper'));
  if (wrappers.length === 0) return () => {};

  const tooltip = document.createElement('div');
  tooltip.className = styles.markdownCellTooltip;
  tooltip.dataset.mdCellTooltip = 'true';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let activeCell: HTMLElement | null = null;
  let frame = 0;

  const cells = wrappers.flatMap(wrapper => (
    Array.from(wrapper.querySelectorAll<HTMLElement>('th, td'))
  ));

  const positionTooltip = (cell: HTMLElement) => {
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportPadding = 12;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, cellRect.left),
    );
    let top = cellRect.bottom + 6;
    if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, cellRect.top - tooltipRect.height - 6);
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    activeCell = null;
    tooltip.hidden = true;
  };

  const showTooltip = (cell: HTMLElement) => {
    if (cell.dataset.mdCellTruncated !== 'true') return;
    const text = (cell.textContent || '').trim();
    if (!text) return;
    activeCell = cell;
    tooltip.textContent = text;
    tooltip.hidden = false;
    tooltip.style.visibility = 'hidden';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    window.requestAnimationFrame(() => {
      if (activeCell !== cell) return;
      positionTooltip(cell);
      tooltip.style.visibility = 'visible';
    });
  };

  const update = () => {
    hideTooltip();
    for (const wrapper of wrappers) {
      const table = wrapper.querySelector<HTMLTableElement>('table');
      if (!table) continue;
      wrapper.classList.remove('md-table-overflowing');
      const isOverflowing = table.scrollWidth > wrapper.clientWidth + 1;
      wrapper.classList.toggle('md-table-overflowing', isOverflowing);
    }
    for (const cell of cells) {
      const isTruncated = cell.closest('.md-table-overflowing') && cell.scrollWidth > cell.clientWidth + 1;
      if (isTruncated) {
        cell.dataset.mdCellTruncated = 'true';
      } else {
        delete cell.dataset.mdCellTruncated;
      }
    }
  };

  const scheduleUpdate = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(update);
  };

  const cleanups: Array<() => void> = [];
  for (const cell of cells) {
    const mouseEnter = () => showTooltip(cell);
    const mouseMove = () => {
      if (activeCell === cell) positionTooltip(cell);
    };
    cell.addEventListener('mouseenter', mouseEnter);
    cell.addEventListener('mousemove', mouseMove);
    cell.addEventListener('mouseleave', hideTooltip);
    cleanups.push(() => {
      cell.removeEventListener('mouseenter', mouseEnter);
      cell.removeEventListener('mousemove', mouseMove);
      cell.removeEventListener('mouseleave', hideTooltip);
      delete cell.dataset.mdCellTruncated;
    });
  }

  const ResizeObserverCtor = window.ResizeObserver;
  let observer: ResizeObserver | null = null;
  if (ResizeObserverCtor) {
    observer = new ResizeObserverCtor(scheduleUpdate);
    observer.observe(root);
    for (const wrapper of wrappers) observer.observe(wrapper);
  }
  window.addEventListener('resize', scheduleUpdate);
  frame = window.requestAnimationFrame(update);

  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleUpdate);
    observer?.disconnect();
    hideTooltip();
    tooltip.remove();
    for (const wrapper of wrappers) wrapper.classList.remove('md-table-overflowing');
    for (const cleanup of cleanups) cleanup();
  };
}

export const MarkdownContent = memo(function MarkdownContent({ html, className, tailFadeCount = 0, sessionPath }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const classes = className ? `md-content ${className}` : 'md-content';

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreClick(event)) return;

    const target = event.target instanceof Element
      ? event.target.closest('a[href]')
      : null;
    if (!(target instanceof HTMLAnchorElement) || !event.currentTarget.contains(target)) return;

    const rawHref = target.getAttribute('href') || '';
    if (!rawHref || rawHref.startsWith('#')) return;

    if (handleExternalUrl(rawHref)) {
      event.preventDefault();
      return;
    }

    const filePath = resolveMarkdownLocalHref(rawHref, sessionPath);
    if (filePath) {
      event.preventDefault();
      const label = target.textContent?.trim() || filePath.split('/').pop() || filePath;
      void openFilePreview(filePath, label, extOfName(filePath) || '', {
        origin: sessionPath ? 'session' : 'desk',
        ...(sessionPath ? { sessionPath } : {}),
      });
      return;
    }

    if (!EXPLICIT_PROTOCOL_RE.test(rawHref)) {
      event.preventDefault();
    }
  }, [sessionPath]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    applyTailFade(ref.current, tailFadeCount);
  }, [html, tailFadeCount]);

  useEffect(() => {
    if (!ref.current) return;
    injectCopyButtons(ref.current);
    const cleanupCodeBlockScrollbars = enhanceCodeBlockScrollbars(ref.current);
    const cleanupTableCellTooltips = enhanceTableCellTooltips(ref.current);
    return () => {
      cleanupTableCellTooltips();
      cleanupCodeBlockScrollbars();
    };
  }, [html]);
  useMermaidDiagrams(ref, [html]);

  return (
    <div
      ref={ref}
      className={classes}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
