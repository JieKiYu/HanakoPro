/**
 * MarkdownContent — 渲染预处理好的 markdown HTML
 *
 * 用 dangerouslySetInnerHTML 设置内容，
 * useEffect 注入代码块复制按钮。
 */

import { memo, useRef, useEffect, useLayoutEffect } from 'react';
import { injectCopyButtons } from '../../utils/format';
import { useMermaidDiagrams } from '../../hooks/use-mermaid-diagrams';
import { splitGraphemes } from '../../utils/grapheme';
import styles from './Chat.module.css';

interface Props {
  html: string;
  className?: string;
  tailFadeCount?: number;
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

function enhanceHorizontalScrollbars(root: HTMLElement): () => void {
  const oldBars = Array.from(root.querySelectorAll<HTMLElement>('[data-md-horizontal-scrollbar="true"]'));
  for (const bar of oldBars) bar.remove();

  const cleanups: Array<() => void> = [];
  const updates: Array<() => void> = [];
  const codeBlocks = Array.from(root.querySelectorAll<HTMLPreElement>('pre'));
  const tableWrappers = Array.from(root.querySelectorAll<HTMLElement>('.md-table-wrapper'));
  const scrollers = [
    ...codeBlocks.map(scroller => ({
      scroller,
      trackClassName: styles.markdownCodeScrollbar,
      thumbClassName: styles.markdownCodeScrollbarThumb,
      insertAfter: scroller,
    })),
    ...tableWrappers.map(scroller => ({
      scroller,
      trackClassName: styles.markdownTableScrollbar,
      thumbClassName: styles.markdownTableScrollbarThumb,
      insertAfter: scroller,
    })),
  ];

  for (const { scroller, trackClassName, thumbClassName, insertAfter } of scrollers) {
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    track.className = trackClassName;
    track.dataset.mdHorizontalScrollbar = 'true';
    thumb.className = thumbClassName;
    track.appendChild(thumb);
    insertAfter.insertAdjacentElement('afterend', track);

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
    for (const { scroller } of scrollers) observer.observe(scroller);
    observer.observe(root);
  }

  return () => {
    observer?.disconnect();
    for (const cleanup of cleanups) cleanup();
  };
}

export const MarkdownContent = memo(function MarkdownContent({ html, className, tailFadeCount = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const classes = className ? `md-content ${className}` : 'md-content';

  useLayoutEffect(() => {
    if (!ref.current) return;
    applyTailFade(ref.current, tailFadeCount);
  }, [html, tailFadeCount]);

  useEffect(() => {
    if (!ref.current) return;
    injectCopyButtons(ref.current);
    return enhanceHorizontalScrollbars(ref.current);
  }, [html]);
  useMermaidDiagrams(ref, [html]);

  return (
    <div
      ref={ref}
      className={classes}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
