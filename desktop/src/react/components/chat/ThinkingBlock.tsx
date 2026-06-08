/**
 * ThinkingBlock — 可折叠的思考过程区块
 */

import { memo, useState, useCallback } from 'react';
import styles from './Chat.module.css';

interface Props {
  content: string;
  sealed: boolean;
}

const INVISIBLE_THINKING_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

function hasVisibleThinkingContent(content: string): boolean {
  return content.replace(INVISIBLE_THINKING_CHARS, '').trim().length > 0;
}

export const ThinkingBlock = memo(function ThinkingBlock({ content, sealed }: Props) {
  const t = window.t ?? ((p: string) => p);
  const hasContent = hasVisibleThinkingContent(content);
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);

  if (sealed && !hasContent) return null;

  return (
    <div className={styles.thinkingBlock} data-open={String(open)}>
      <button
        type="button"
        className={styles.thinkingBlockSummary}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={`${styles.thinkingBlockArrow}${open ? ` ${styles.thinkingBlockArrowOpen}` : ''}`}>›</span>
        {' '}{sealed ? t('thinking.done') : (
          <>{t('thinking.active')}<span className={styles.thinkingDots} /></>
        )}
      </button>
      {open && hasContent && (
        <div className={styles.thinkingBlockBody}>{content}</div>
      )}
    </div>
  );
});
