import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { PlanModeButton, type PermissionMode } from './PlanModeButton';
import { ContextCompressButton, ContextRing } from './ContextRing';
import { ThinkingLevelButton } from './ThinkingLevelButton';
import { ModelSelector } from './ModelSelector';
import { SendButton } from './SendButton';
import type { ModelsLoadState, ThinkingLevel } from '../../stores/model-slice';
import type { Model } from '../../types';
import type { SessionModel } from '../../stores/chat-types';
import styles from './InputArea.module.css';

export function GoalIcon({ tone = 'plain' }: { tone?: 'plain' | 'active' }) {
  const active = tone === 'active';
  return (
    <svg
      className={`${styles['goal-icon']} ${active ? styles['goal-icon-active'] : ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle className={styles['goal-icon-target-outer']} cx="7" cy="9" r="5.35" />
      <circle className={styles['goal-icon-target-middle']} cx="7" cy="9" r="3.2" />
      <circle className={styles['goal-icon-target-center']} cx="7" cy="9" r="1.05" />
      <path
        className={styles['goal-icon-arrow-shaft']}
        d="M7 9 11.1 4.9"
      />
      <path
        className={styles['goal-icon-arrow']}
        d="M10.7 5.3V3.1L12.9.9h.9v2.35h2.35v.9l-2.2 2.2h-2.2"
      />
    </svg>
  );
}

function AttachFileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.85 4.25v6.08a2.35 2.35 0 0 1-4.7 0V4.78a3.32 3.32 0 0 1 6.64 0v5.55a4.45 4.45 0 0 1-8.9 0V5.6" />
    </svg>
  );
}

function GoalCancelIcon() {
  return (
    <svg
      className={styles['goal-chip-close-icon']}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
      <path d="M5.4 5.4 10.6 10.6M10.6 5.4 5.4 10.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  t: (key: string) => string;
  // 左侧工具按钮
  onAttach: () => void;
  onGoalOpen: () => void;
  onGoalClose: () => void;
  goalEditing: boolean;
  goalDrafting?: boolean;
  goalSaving?: boolean;
  goalRunning?: boolean;
  slashBtnRef: RefObject<HTMLButtonElement | null>;
  onSlashToggle: () => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (v: PermissionMode) => void;
  planModeLocked: boolean;
  // 右侧控制
  showThinking: boolean;
  thinkingLevel: ThinkingLevel;
  onThinkingChange: (level: ThinkingLevel) => void;
  modelXhigh: boolean;
  models: Model[];
  modelsLoadState: ModelsLoadState;
  sessionModel?: SessionModel;
  isStreaming: boolean;
  hasInput: boolean;
  canSend: boolean;
  onSend: () => void;
  onSteer: () => void;
  onStop: () => void;
}

/** 编辑器下方的工具按钮行 + 发送控制 */
export const InputControlBar = memo(function InputControlBar(props: Props) {
  const {
    t, onAttach, slashBtnRef, onSlashToggle,
    onGoalOpen, onGoalClose, goalEditing, goalDrafting = false, goalSaving = false, goalRunning = false,
    permissionMode, onPermissionModeChange, planModeLocked,
    showThinking, thinkingLevel, onThinkingChange, modelXhigh,
    models, modelsLoadState, sessionModel, isStreaming, hasInput, canSend, onSend, onSteer, onStop,
  } = props;
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [addMenuOpen]);

  return (
    <div className={styles['input-bottom-bar']}>
      <div className={styles['input-actions']}>
        <div ref={addMenuRef} className={`${styles['add-menu-wrap']} ${addMenuOpen ? styles.open : ''}`}>
          <button
            className={styles['attach-btn']}
            title={t('input.addMenu')}
            onClick={() => setAddMenuOpen(v => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className={styles['add-menu']}>
            <button
              className={styles['add-menu-item']}
              onClick={() => {
                setAddMenuOpen(false);
                onAttach();
              }}
            >
              <span className={styles['add-menu-item-main']}>
                <span className={styles['add-menu-icon']} aria-hidden="true">
                  <AttachFileIcon />
                </span>
                <span>{t('input.attachFiles')}</span>
              </span>
            </button>
            <button
              type="button"
              className={`${styles['add-menu-item']} ${goalEditing ? styles.active : ''}`}
              aria-pressed={goalEditing}
              title={goalEditing ? t('input.goalCancel') : t('input.goalMode')}
              onClick={() => {
                setAddMenuOpen(false);
                if (goalEditing) onGoalClose();
                else onGoalOpen();
              }}
            >
              <span className={styles['add-menu-item-main']}>
                <span className={styles['add-menu-icon']} aria-hidden="true">
                  <GoalIcon tone="plain" />
                </span>
                <span>{t('input.goalMode')}</span>
              </span>
              <span className={`${styles['add-menu-switch']} ${goalEditing ? styles.on : ''}`} aria-hidden="true">
                <span />
              </span>
            </button>
          </div>
        </div>
        <button
          ref={slashBtnRef}
          className={styles['attach-btn']}
          title={t('input.commandMenu')}
          onClick={onSlashToggle}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
          </svg>
        </button>
        <PlanModeButton mode={permissionMode} onChange={onPermissionModeChange} locked={planModeLocked} />
        {goalDrafting && (
          <button
            type="button"
            className={styles['goal-chip']}
            title={goalSaving ? t('input.goalSaving') : t('input.goalCancel')}
            disabled={goalSaving}
            onClick={onGoalClose}
          >
            <span className={styles['goal-chip-icon-stack']} aria-hidden="true">
              <GoalIcon tone="active" />
              <GoalCancelIcon />
            </span>
            <span>{t('input.goalMode')}</span>
          </button>
        )}
        <ContextRing />
      </div>
      <div className={styles['input-controls']}>
        {showThinking && (
          <ThinkingLevelButton level={thinkingLevel} onChange={onThinkingChange} modelXhigh={modelXhigh} />
        )}
        <ModelSelector models={models} sessionModel={sessionModel} isStreaming={isStreaming} loadState={modelsLoadState} />
        <ContextCompressButton />
        <SendButton isStreaming={isStreaming} goalRunning={goalRunning} hasInput={hasInput}
          disabled={goalDrafting ? !canSend : (isStreaming && !goalRunning ? false : !canSend)}
          onSend={onSend} onSteer={onSteer} onStop={onStop} forceSend={goalDrafting} />
      </div>
    </div>
  );
});
