import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../store';
import { t } from '../helpers';
import { MemorySection } from './agent/AgentMemory';
import styles from '../Settings.module.css';

const MEMORY_DESIGN_LAYERS = ['ding', 'luo', 'jing', 'jian'] as const;

export function MemoryTab() {
  const {
    currentAgentId,
    settingsAgentId,
    settingsConfig,
    currentPins,
    globalModelsConfig,
  } = useSettingsStore(
    useShallow(s => ({
      currentAgentId: s.currentAgentId,
      settingsAgentId: s.settingsAgentId,
      settingsConfig: s.settingsConfig,
      currentPins: s.currentPins,
      globalModelsConfig: s.globalModelsConfig,
    })),
  );

  const selectedSettingsAgentId = settingsAgentId || currentAgentId;
  const isViewingOther = selectedSettingsAgentId !== currentAgentId;
  const modelConfig = {
    ...(globalModelsConfig?.models || {}),
    ...(settingsConfig?.models || {}),
  };
  const hasMemoryModel = !!(modelConfig.chat || modelConfig.utility_large || modelConfig.utility);
  const memoryEnabled = settingsConfig?.memory?.enabled !== false;
  const memoryUse = settingsConfig?.memory?.use !== false;
  const memoryGenerate = settingsConfig?.memory?.generate !== false;

  return (
    <div className={`${styles['settings-tab-content']} ${styles['active']}`} data-tab="memory">
      <MemorySection
        hasMemoryModel={hasMemoryModel}
        memoryEnabled={memoryEnabled}
        memoryUse={memoryUse}
        memoryGenerate={memoryGenerate}
        isViewingOther={isViewingOther}
        currentPins={currentPins}
      />
      <div className={styles['memory-guide-card']}>
        <div className={styles['memory-guide-copy']}>
          <div className={styles['memory-guide-eyebrow']}>{t('settings.memory.guideEyebrow')}</div>
          <div className={styles['memory-guide-title']}>{t('settings.memory.guideTitle')}</div>
          <div className={styles['memory-guide-text']}>
            <p>{t('settings.memory.guidePrinciple')}</p>
            <p>{t('settings.memory.guidePriority')}</p>
          </div>
        </div>
        <div className={styles['memory-guide-layers']}>
          {MEMORY_DESIGN_LAYERS.map((layer) => (
            <div className={styles['memory-guide-layer']} key={layer}>
              <span className={styles['memory-guide-layer-name']}>{t(`settings.memory.guideLayers.${layer}.name`)}</span>
              <span className={styles['memory-guide-layer-text']}>{t(`settings.memory.guideLayers.${layer}.text`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
