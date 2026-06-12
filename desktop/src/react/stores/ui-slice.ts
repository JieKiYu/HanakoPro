import type { ActivePanel, RightWorkspaceTab, TabType } from '../types';
import type { FileRef } from '../types/file-ref';
import { INLINE_TERMINAL_DEFAULT_HEIGHT, clampInlineTerminalHeight } from '../terminal/inline-terminal-height';

export interface MediaViewerState {
  files: FileRef[];
  currentId: string;
  origin: 'desk' | 'session';
}

export interface SettingsModalState {
  open: boolean;
  activeTab: string;
}

export interface InlineTerminalRecord {
  id: string;
  title?: string;
  cwd?: string;
  alive?: boolean;
}

export interface UiSlice {
  sidebarOpen: boolean;
  sidebarAutoCollapsed: boolean;
  jianOpen: boolean;
  jianAutoCollapsed: boolean;
  previewOpen: boolean;
  welcomeVisible: boolean;
  currentTab: TabType;
  activePanel: ActivePanel;
  rightWorkspaceTab: RightWorkspaceTab;
  jianDrawerOpen: boolean;
  locale: string;
  /** Skill 预览 overlay 数据（null = 关闭） */
  skillViewerData: { name: string; baseDir: string; filePath?: string; installed?: boolean } | null;
  /** 媒体预览 overlay 状态（null = 关闭） */
  mediaViewer: MediaViewerState | null;
  /** 主窗口内嵌设置浮层状态 */
  settingsModal: SettingsModalState;
  /** 频道创建弹窗是否可见 */
  channelCreateOverlayVisible: boolean;
  /** 聊天搜索查询（从左侧会话搜索传入） */
  chatSearchQuery: string | null;
  /** 主窗口底部内嵌终端是否打开 */
  inlineTerminalOpen: boolean;
  /** 主窗口底部内嵌终端高度 px */
  inlineTerminalHeight: number;
  /** 每个会话自己的默认底部终端 */
  inlineTerminalBySession: Record<string, InlineTerminalRecord>;
  setSidebarOpen: (open: boolean) => void;
  setSidebarAutoCollapsed: (collapsed: boolean) => void;
  setJianOpen: (open: boolean) => void;
  setJianAutoCollapsed: (collapsed: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setWelcomeVisible: (visible: boolean) => void;
  setCurrentTab: (tab: TabType) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setRightWorkspaceTab: (tab: RightWorkspaceTab) => void;
  setJianDrawerOpen: (open: boolean) => void;
  setChannelCreateOverlayVisible: (visible: boolean) => void;
  setMediaViewer: (state: MediaViewerState | null) => void;
  setSettingsModal: (state: SettingsModalState) => void;
  setMediaViewerCurrent: (id: string) => void;
  closeMediaViewer: () => void;
  toggleSidebar: () => void;
  toggleJian: () => void;
  setChatSearchQuery: (query: string | null) => void;
  setInlineTerminalOpen: (open: boolean) => void;
  toggleInlineTerminal: () => void;
  setInlineTerminalHeight: (height: number, viewportHeight?: number) => void;
  setInlineTerminalForSession: (sessionPath: string, terminal: InlineTerminalRecord | null) => void;
}

export const createUiSlice = (
  set: (partial: Partial<UiSlice> | ((s: UiSlice) => Partial<UiSlice>)) => void
): UiSlice => ({
  sidebarOpen: true,
  sidebarAutoCollapsed: false,
  jianOpen: true,
  jianAutoCollapsed: false,
  previewOpen: false,
  welcomeVisible: true,
  currentTab: 'chat',
  activePanel: null,
  rightWorkspaceTab: 'workspace',
  jianDrawerOpen: false,
  // Keep locale empty until i18n.load() finishes so the first successful
  // locale sync always triggers a rerender, even for the default zh locale.
  locale: '',
  skillViewerData: null,
  mediaViewer: null,
  settingsModal: { open: false, activeTab: 'agent' },
  channelCreateOverlayVisible: false,
  chatSearchQuery: null,
  inlineTerminalOpen: false,
  inlineTerminalHeight: INLINE_TERMINAL_DEFAULT_HEIGHT,
  inlineTerminalBySession: {},
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarAutoCollapsed: (collapsed) => set({ sidebarAutoCollapsed: collapsed }),
  setJianOpen: (open) => set({ jianOpen: open }),
  setJianAutoCollapsed: (collapsed) => set({ jianAutoCollapsed: collapsed }),
  setPreviewOpen: (open) => set({ previewOpen: open }),
  setWelcomeVisible: (visible) => set({ welcomeVisible: visible }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setRightWorkspaceTab: (tab) => set({ rightWorkspaceTab: tab }),
  setJianDrawerOpen: (open) => set({ jianDrawerOpen: open }),
  setChannelCreateOverlayVisible: (visible) => set({ channelCreateOverlayVisible: visible }),
  setMediaViewer: (state) => set({ mediaViewer: state }),
  setSettingsModal: (state) => set({ settingsModal: state }),
  setMediaViewerCurrent: (id) => set((s) => ({
    mediaViewer: s.mediaViewer ? { ...s.mediaViewer, currentId: id } : null,
  })),
  closeMediaViewer: () => set({ mediaViewer: null }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleJian: () => set((s) => ({ jianOpen: !s.jianOpen })),
  setChatSearchQuery: (query) => set({ chatSearchQuery: query }),
  setInlineTerminalOpen: (open) => set({ inlineTerminalOpen: open }),
  toggleInlineTerminal: () => set((s) => ({ inlineTerminalOpen: !s.inlineTerminalOpen })),
  setInlineTerminalHeight: (height, viewportHeight) => set({
    inlineTerminalHeight: clampInlineTerminalHeight(
      height,
      viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 900),
    ),
  }),
  setInlineTerminalForSession: (sessionPath, terminal) =>
    set((s) => {
      if (!terminal) {
        const { [sessionPath]: _, ...rest } = s.inlineTerminalBySession;
        return { inlineTerminalBySession: rest };
      }
      return {
        inlineTerminalBySession: {
          ...s.inlineTerminalBySession,
          [sessionPath]: terminal,
        },
      };
    }),
});
