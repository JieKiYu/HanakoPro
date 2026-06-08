import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function cssBlock(css: string, selector: string): string {
  return css.match(new RegExp(`${selector}\\s*\\{(?<body>[^}]*)\\}`))?.groups?.body || '';
}

describe('InputArea layout', () => {
  it('keeps chat, composer, welcome, and bridge widths in their intended lanes', () => {
    const globalCss = fs.readFileSync(path.join(process.cwd(), 'desktop/src/styles.css'), 'utf8');
    const chatCss = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );
    const pluginCardCss = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/PluginCardBlock.module.css'),
      'utf8',
    );
    const floatingCss = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/FloatingPanels.module.css'),
      'utf8',
    );

    const inputAreaBlock = cssBlock(globalCss, String.raw`\.input-area > \*`);
    const welcomeInputAreaBlock = cssBlock(globalCss, String.raw`\.main-content\.welcome-mode \.input-area > \*`);
    const sessionMessagesBlock = cssBlock(chatCss, String.raw`\.sessionMessages`);
    const sessionShellBlock = cssBlock(chatCss, String.raw`\.sessionShell`);
    const sessionShellAfterBlock = cssBlock(chatCss, String.raw`\.sessionShell::after`);
    const sessionFooterBlock = cssBlock(chatCss, String.raw`\.sessionFooter`);
    const assistantMessageBlock = cssBlock(chatCss, String.raw`\.messageGroupAssistant \.message`);
    const messageAssistantBlock = cssBlock(chatCss, String.raw`\.messageAssistant`);
    const assistantMarkdownBlock = cssBlock(chatCss, String.raw`\.messageAssistant :global\(\.md-content\)`);
    const moodWrapperBlock = cssBlock(chatCss, String.raw`\.moodWrapper`);
    const moodBlock = cssBlock(chatCss, String.raw`\.moodBlock`);
    const cronConfirmCardBlock = cssBlock(chatCss, String.raw`\.cronConfirmCard`);
    const settingsConfirmCardBlock = cssBlock(chatCss, String.raw`\.settingsConfirmCard`);
    const toolGroupBlock = cssBlock(chatCss, String.raw`\.toolGroup`);
    const toolGroupWithDiffBlock = cssBlock(chatCss, String.raw`\.toolGroupWithDiff`);
    const toolGroupWithCodeBlock = cssBlock(chatCss, String.raw`\.toolGroupWithCode`);
    const toolGroupContentBlock = cssBlock(chatCss, String.raw`\.toolGroupContent`);
    const toolGroupWithCodeContentBlock = cssBlock(chatCss, String.raw`\.toolGroupWithCode \.toolGroupContent`);
    const toolIndicatorBlock = cssBlock(chatCss, String.raw`\.toolIndicator`);
    const toolProgressRowBlock = cssBlock(chatCss, String.raw`\.toolProgressRow`);
    const markdownTableWrapperBlock = cssBlock(globalCss, String.raw`\.md-content \.md-table-wrapper`);
    const markdownTableOverflowingWrapperBlock = cssBlock(globalCss, String.raw`\.md-content \.md-table-wrapper\.md-table-overflowing`);
    const markdownTableBlock = cssBlock(globalCss, String.raw`\.md-content table`);
    const markdownOverflowingTableBlock = cssBlock(globalCss, String.raw`\.md-content \.md-table-wrapper\.md-table-overflowing table`);
    const markdownOverflowingCellBlock = cssBlock(
      globalCss,
      String.raw`\.md-content \.md-table-wrapper\.md-table-overflowing th,\s*\.md-content \.md-table-wrapper\.md-table-overflowing td`,
    );
    const assistantMarkdownTableWrapperBlock = cssBlock(chatCss, String.raw`\.messageAssistant :global\(\.md-content \.md-table-wrapper\)`);
    const liveFileWriteCardBlock = cssBlock(chatCss, String.raw`\.liveFileWriteCard`);
    const toolGroupLiveFileWriteCardBlock = cssBlock(chatCss, String.raw`\.toolGroupWithCode \.liveFileWriteCard`);
    const liveFileWritePreviewBlock = cssBlock(chatCss, String.raw`\.liveFileWritePreview`);
    const liveFileWritePreviewPreBlock = cssBlock(chatCss, String.raw`\.liveFileWritePreview pre`);
    const memoryUpdateNoticeBlock = cssBlock(chatCss, String.raw`\.memoryUpdateNotice`);
    const toolExpandedDetailsBlock = cssBlock(chatCss, String.raw`\.toolExpandedDetails`);
    const toolExpandedSectionBlock = cssBlock(chatCss, String.raw`\.toolExpandedSection`);
    const toolExpandedPreBlock = cssBlock(chatCss, String.raw`\.toolExpandedPre`);
    const toolGroupExpandedPreBlock = cssBlock(chatCss, String.raw`\.toolGroupWithCode \.toolExpandedPre`);
    const visionProgressCardBlock = cssBlock(chatCss, String.raw`\.visionProgressCard`);
    const visionProgressSectionBlock = cssBlock(chatCss, String.raw`\.visionProgressSection`);
    const visionProgressPreBlock = cssBlock(chatCss, String.raw`\.visionProgressSection pre`);
    const fileOutputCardBlock = cssBlock(chatCss, String.raw`\.fileOutputCard`);
    const terminalCardBlock = cssBlock(chatCss, String.raw`\.terminalCard`);
    const terminalCardBodyBlock = cssBlock(chatCss, String.raw`\.terminalCardBody`);
    const diffCardBlock = cssBlock(chatCss, String.raw`\.diffCard`);
    const diffCardBodyBlock = cssBlock(chatCss, String.raw`\.diffCardBody`);
    const diffCardBodyScrollbarBlock = cssBlock(chatCss, String.raw`\.diffCardBody::-webkit-scrollbar`);
    const diffTableBlock = cssBlock(chatCss, String.raw`\.diffTable`);
    const diffLineTextBlock = cssBlock(chatCss, String.raw`\.diffLineText`);
    const diffHorizontalScrollbarBlock = cssBlock(chatCss, String.raw`\.diffHorizontalScrollbar`);
    const markdownCodeScrollbarBlock = cssBlock(chatCss, String.raw`\.markdownCodeScrollbar`);
    const markdownCellTooltipBlock = cssBlock(chatCss, String.raw`\.markdownCellTooltip`);
    const markdownPreBlock = cssBlock(globalCss, String.raw`\.md-content pre`);
    const markdownPreScrollbarBlock = cssBlock(globalCss, String.raw`\.md-content pre::-webkit-scrollbar`);
    const markdownPreCodeBlock = cssBlock(globalCss, String.raw`\.md-content pre code`);
    const pluginCardContainerBlock = cssBlock(pluginCardCss, String.raw`\.container`);
    const pluginCardIframeBlock = cssBlock(pluginCardCss, String.raw`\.iframe`);

    expect(globalCss).toMatch(/--chat-column-width:\s*min\(64rem,\s*100%\)/);
    expect(globalCss).toMatch(/--chat-input-column-extra:\s*1\.25rem/);
    expect(globalCss).toMatch(/--chat-input-column-width:\s*min\(100%,\s*calc\(var\(--chat-column-width\) \+ var\(--chat-input-column-extra\)\)\)/);
    expect(globalCss).toMatch(/--welcome-chat-input-column-width:\s*40rem/);
    expect(inputAreaBlock).toMatch(/max-width:\s*var\(--chat-input-column-width\)/);
    expect(welcomeInputAreaBlock).toMatch(/max-width:\s*var\(--welcome-chat-input-column-width\)/);
    expect(sessionMessagesBlock).toMatch(/max-width:\s*var\(--chat-column-width\)/);
    expect(sessionShellBlock).toMatch(/--chat-input-occlusion-height:\s*calc\(var\(--input-card-h,\s*0px\) \+ var\(--space-lg\) \+ 1\.5rem\)/);
    expect(sessionShellAfterBlock).toMatch(/pointer-events:\s*none/);
    expect(sessionShellAfterBlock).toMatch(/height:\s*var\(--chat-input-occlusion-height\)/);
    expect(sessionShellAfterBlock).toMatch(/linear-gradient/);
    expect(sessionFooterBlock).toMatch(/height:\s*calc\(var\(--input-card-h,\s*0px\) \+ var\(--space-lg\) \+ 5rem\)/);
    expect(assistantMessageBlock).toMatch(/width:\s*100%/);
    expect(assistantMessageBlock).toMatch(/max-width:\s*100%/);
    expect(messageAssistantBlock).toMatch(/--chat-message-action-safe-area:\s*7rem/);
    expect(messageAssistantBlock).toMatch(/--chat-message-content-width:\s*calc\(100% - var\(--chat-message-action-safe-area\)\)/);
    expect(messageAssistantBlock).toMatch(/--chat-code-block-width:\s*var\(--chat-message-content-width\)/);
    expect(messageAssistantBlock).toMatch(/--chat-module-card-inset:\s*0\.75rem/);
    expect(messageAssistantBlock).toMatch(/--chat-module-inner-x:\s*0\.75rem/);
    expect(assistantMarkdownBlock).toMatch(/width:\s*var\(--chat-message-content-width,\s*100%\)/);
    expect(assistantMarkdownBlock).toMatch(/max-width:\s*var\(--chat-message-content-width,\s*100%\)/);
    expect(assistantMarkdownBlock).toMatch(/box-sizing:\s*border-box/);
    expect(assistantMarkdownBlock).toMatch(/--chat-code-block-width:\s*100%/);
    expect(markdownTableWrapperBlock).toMatch(/display:\s*block/);
    expect(markdownTableWrapperBlock).toMatch(/width:\s*fit-content/);
    expect(markdownTableWrapperBlock).toMatch(/max-width:\s*100%/);
    expect(markdownTableWrapperBlock).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(markdownTableWrapperBlock).toMatch(/border-radius:\s*var\(--radius-sm\)/);
    expect(markdownTableWrapperBlock).toMatch(/overflow:\s*visible/);
    expect(markdownTableOverflowingWrapperBlock).toMatch(/width:\s*100%/);
    expect(markdownTableBlock).toMatch(/border-collapse:\s*separate/);
    expect(markdownTableBlock).toMatch(/border-spacing:\s*0/);
    expect(markdownTableBlock).toMatch(/width:\s*max-content/);
    expect(markdownTableBlock).toMatch(/max-width:\s*none/);
    expect(markdownTableBlock).toMatch(/margin:\s*0/);
    expect(markdownTableBlock).not.toMatch(/width:\s*100%/);
    expect(markdownTableBlock).not.toMatch(/display:\s*block/);
    expect(markdownOverflowingTableBlock).toMatch(/width:\s*100%/);
    expect(markdownOverflowingTableBlock).toMatch(/table-layout:\s*fixed/);
    expect(markdownOverflowingCellBlock).toMatch(/overflow:\s*hidden/);
    expect(markdownOverflowingCellBlock).toMatch(/text-overflow:\s*ellipsis/);
    expect(markdownOverflowingCellBlock).toMatch(/white-space:\s*nowrap/);
    expect(globalCss).not.toMatch(/cursor:\s*help/);
    expect(assistantMarkdownTableWrapperBlock).toMatch(/max-width:\s*100%/);
    expect(globalCss).toMatch(/\.md-content th\s*\{[\s\S]*background:\s*var\(--markdown-table-head-bg,\s*var\(--overlay-subtle\)\)/);
    expect(chatCss).toMatch(/\.messageAssistant :global\(\.md-content th\),\s*\.messageAssistant :global\(\.md-content td\)\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
    expect(moodWrapperBlock).toMatch(/--mood-psych-color:\s*#8F1D4F/);
    expect(moodBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(moodBlock).toMatch(/max-width:\s*100%/);
    expect(moodBlock).toMatch(/box-sizing:\s*border-box/);
    expect(cronConfirmCardBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(cronConfirmCardBlock).toMatch(/max-width:\s*100%/);
    expect(cronConfirmCardBlock).not.toMatch(/width:\s*fit-content|max-width:\s*360px/);
    expect(settingsConfirmCardBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(settingsConfirmCardBlock).toMatch(/max-width:\s*100%/);
    expect(settingsConfirmCardBlock).toMatch(/min-width:\s*0/);
    expect(settingsConfirmCardBlock).not.toMatch(/min-width:\s*320px|max-width:\s*420px/);
    expect(toolGroupBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(toolGroupBlock).toMatch(/max-width:\s*100%/);
    expect(toolGroupBlock).toMatch(/min-width:\s*0/);
    expect(toolGroupBlock).toMatch(/box-sizing:\s*border-box/);
    expect(toolGroupBlock).not.toMatch(/width:\s*fit-content/);
    expect(toolGroupWithDiffBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(toolGroupWithCodeBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(toolGroupWithCodeBlock).toMatch(/max-width:\s*100%/);
    expect(toolGroupWithCodeBlock).toMatch(/min-width:\s*0/);
    expect(toolGroupContentBlock).toMatch(/min-width:\s*0/);
    expect(toolGroupContentBlock).toMatch(/width:\s*100%/);
    expect(toolGroupContentBlock).toMatch(/box-sizing:\s*border-box/);
    expect(toolGroupWithCodeContentBlock).toMatch(/width:\s*100%/);
    expect(toolGroupWithCodeContentBlock).toMatch(/box-sizing:\s*border-box/);
    expect(toolIndicatorBlock).toMatch(/width:\s*100%/);
    expect(toolIndicatorBlock).toMatch(/max-width:\s*100%/);
    expect(toolIndicatorBlock).not.toMatch(/max-width:\s*400px/);
    expect(toolProgressRowBlock).toMatch(/width:\s*100%/);
    expect(toolProgressRowBlock).toMatch(/max-width:\s*100%/);
    expect(toolProgressRowBlock).toMatch(/min-width:\s*0/);
    expect(toolProgressRowBlock).not.toMatch(/max-width:\s*400px/);
    expect(liveFileWriteCardBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(toolGroupLiveFileWriteCardBlock).toMatch(/width:\s*100%/);
    expect(liveFileWriteCardBlock).not.toMatch(/720px/);
    expect(liveFileWritePreviewBlock).toMatch(/overflow-x:\s*auto/);
    expect(liveFileWritePreviewPreBlock).toMatch(/white-space:\s*pre/);
    expect(liveFileWritePreviewPreBlock).toMatch(/word-break:\s*normal/);
    expect(memoryUpdateNoticeBlock).toMatch(/width:\s*100%/);
    expect(memoryUpdateNoticeBlock).toMatch(/max-width:\s*100%/);
    expect(memoryUpdateNoticeBlock).not.toMatch(/640px|78vw/);
    expect(toolExpandedDetailsBlock).toMatch(/width:\s*100%/);
    expect(toolExpandedDetailsBlock).toMatch(/min-width:\s*0/);
    expect(toolExpandedSectionBlock).toMatch(/min-width:\s*0/);
    expect(toolExpandedPreBlock).toMatch(/width:\s*100%/);
    expect(toolExpandedPreBlock).toMatch(/white-space:\s*pre/);
    expect(toolExpandedPreBlock).toMatch(/overflow-x:\s*auto/);
    expect(toolExpandedPreBlock).toMatch(/overflow-y:\s*auto/);
    expect(toolGroupExpandedPreBlock).toMatch(/width:\s*100%/);
    expect(visionProgressCardBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(visionProgressCardBlock).toMatch(/max-width:\s*100%/);
    expect(visionProgressCardBlock).not.toMatch(/720px/);
    expect(visionProgressSectionBlock).toMatch(/min-width:\s*0/);
    expect(visionProgressPreBlock).toMatch(/overflow-x:\s*auto/);
    expect(visionProgressPreBlock).toMatch(/white-space:\s*pre/);
    expect(visionProgressPreBlock).toMatch(/word-break:\s*normal/);
    expect(fileOutputCardBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(fileOutputCardBlock).toMatch(/max-width:\s*100%/);
    expect(fileOutputCardBlock).toMatch(/min-width:\s*0/);
    expect(fileOutputCardBlock).not.toMatch(/max-width:\s*420px|min-width:\s*300px/);
    expect(terminalCardBlock).not.toMatch(/--chat-module-card-inset:\s*/);
    expect(terminalCardBlock).not.toMatch(/--chat-module-inner-x:\s*/);
    expect(terminalCardBlock).toMatch(/margin:\s*6px\s+var\(--chat-module-card-inset\)\s+8px/);
    expect(terminalCardBlock).toMatch(/width:\s*calc\(100% - var\(--chat-module-card-inset\) - var\(--chat-module-card-inset\)\)/);
    expect(terminalCardBlock).toMatch(/max-width:\s*calc\(100% - var\(--chat-module-card-inset\) - var\(--chat-module-card-inset\)\)/);
    expect(terminalCardBlock).not.toMatch(/860px/);
    expect(terminalCardBodyBlock).toMatch(/padding:\s*8px\s+var\(--chat-module-inner-x\)\s+10px/);
    expect(terminalCardBodyBlock).toMatch(/white-space:\s*pre/);
    expect(terminalCardBodyBlock).toMatch(/overflow:\s*auto/);
    expect(diffCardBlock).not.toMatch(/--chat-module-card-inset:\s*/);
    expect(diffCardBlock).not.toMatch(/--chat-module-inner-x:\s*/);
    expect(diffCardBlock).toMatch(/margin:\s*6px\s+var\(--chat-module-card-inset\)\s+8px/);
    expect(diffCardBlock).toMatch(/width:\s*calc\(100% - var\(--chat-module-card-inset\) - var\(--chat-module-card-inset\)\)/);
    expect(diffCardBlock).toMatch(/max-width:\s*calc\(100% - var\(--chat-module-card-inset\) - var\(--chat-module-card-inset\)\)/);
    expect(diffCardBlock).toMatch(/word-break:\s*normal/);
    expect(diffCardBlock).not.toMatch(/max-width:\s*720px/);
    expect(diffCardBodyBlock).toMatch(/box-sizing:\s*border-box/);
    expect(diffCardBodyBlock).toMatch(/padding:\s*0\s+var\(--chat-module-inner-x\)/);
    expect(diffCardBodyBlock).toMatch(/overflow-x:\s*scroll/);
    expect(diffCardBodyBlock).toMatch(/scrollbar-width:\s*none/);
    expect(diffCardBodyBlock).toMatch(/word-break:\s*normal/);
    expect(diffTableBlock).toMatch(/table-layout:\s*auto/);
    expect(diffTableBlock).toMatch(/width:\s*max-content/);
    expect(diffTableBlock).toMatch(/min-width:\s*100%/);
    expect(diffLineTextBlock).toMatch(/display:\s*table-cell/);
    expect(diffLineTextBlock).toMatch(/width:\s*max-content/);
    expect(diffLineTextBlock).toMatch(/min-width:\s*max-content/);
    expect(diffLineTextBlock).toMatch(/overflow:\s*visible/);
    expect(diffLineTextBlock).toMatch(/word-break:\s*normal/);
    expect(diffLineTextBlock).not.toMatch(/overflow:\s*hidden/);
    expect(diffCardBodyScrollbarBlock).toMatch(/display:\s*none/);
    expect(diffCardBodyScrollbarBlock).toMatch(/height:\s*0/);
    expect(diffHorizontalScrollbarBlock).toMatch(/height:\s*12px/);
    expect(diffHorizontalScrollbarBlock).toMatch(/margin:\s*0\s+var\(--chat-module-inner-x\)\s+6px/);
    expect(diffHorizontalScrollbarBlock).toMatch(/touch-action:\s*none/);
    expect(markdownCodeScrollbarBlock).toMatch(/width:\s*calc\(var\(--chat-code-block-width,\s*100%\) - var\(--chat-module-card-inset,\s*0\.75rem\) - var\(--chat-module-card-inset,\s*0\.75rem\)\)/);
    expect(markdownCodeScrollbarBlock).toMatch(/max-width:\s*calc\(100% - var\(--chat-module-card-inset,\s*0\.75rem\) - var\(--chat-module-card-inset,\s*0\.75rem\)\)/);
    expect(markdownCodeScrollbarBlock).toMatch(/margin:\s*calc\(-1 \* var\(--space-xs\)\)\s+var\(--chat-module-card-inset,\s*0\.75rem\)\s+var\(--space-sm\)/);
    expect(markdownCodeScrollbarBlock).toMatch(/height:\s*12px/);
    expect(markdownCodeScrollbarBlock).toMatch(/touch-action:\s*none/);
    expect(chatCss).toMatch(/\.markdownCodeScrollbarThumb/);
    expect(markdownCellTooltipBlock).toMatch(/position:\s*fixed/);
    expect(markdownCellTooltipBlock).toMatch(/pointer-events:\s*none/);
    expect(markdownCellTooltipBlock).toMatch(/white-space:\s*normal/);
    expect(markdownPreBlock).toMatch(/width:\s*calc\(var\(--chat-code-block-width,\s*100%\) - var\(--chat-module-card-inset,\s*0\.75rem\) - var\(--chat-module-card-inset,\s*0\.75rem\)\)/);
    expect(markdownPreBlock).toMatch(/max-width:\s*calc\(100% - var\(--chat-module-card-inset,\s*0\.75rem\) - var\(--chat-module-card-inset,\s*0\.75rem\)\)/);
    expect(markdownPreBlock).toMatch(/margin:\s*var\(--space-sm\)\s+var\(--chat-module-card-inset,\s*0\.75rem\)/);
    expect(markdownPreBlock).toMatch(/overflow-x:\s*auto/);
    expect(markdownPreBlock).toMatch(/scrollbar-width:\s*none/);
    expect(markdownPreBlock).toMatch(/white-space:\s*pre/);
    expect(markdownPreBlock).toMatch(/word-break:\s*normal/);
    expect(markdownPreScrollbarBlock).toMatch(/display:\s*none/);
    expect(markdownPreScrollbarBlock).toMatch(/height:\s*0/);
    expect(markdownPreCodeBlock).toMatch(/display:\s*inline-block/);
    expect(markdownPreCodeBlock).toMatch(/min-width:\s*max-content/);
    expect(markdownPreCodeBlock).toMatch(/white-space:\s*pre/);
    expect(markdownPreCodeBlock).toMatch(/word-break:\s*normal/);
    expect(pluginCardContainerBlock).toMatch(/width:\s*var\(--chat-code-block-width,\s*100%\)/);
    expect(pluginCardContainerBlock).toMatch(/max-width:\s*100%/);
    expect(pluginCardContainerBlock).toMatch(/overflow-x:\s*auto/);
    expect(pluginCardContainerBlock).not.toMatch(/display:\s*inline-block/);
    expect(pluginCardIframeBlock).toMatch(/max-width:\s*none/);
    expect(floatingCss).not.toMatch(/--chat-column-width:\s*var\(--bridge-chat-column-width\)/);
  });

  it('keeps composer horizontal padding symmetric with the left inset', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/input/InputArea.module.css'),
      'utf8',
    );
    const inputWrapperBlock = cssBlock(css, String.raw`\.input-wrapper`);

    expect(inputWrapperBlock).toMatch(/padding:\s*var\(--space-md\)\s+var\(--space-md\)\s+var\(--space-sm\)/);
  });

  it('uses the main composer for goal editing instead of nesting a second textbox', () => {
    const inputAreaSource = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/InputArea.tsx'),
      'utf8',
    );
    const controlBarSource = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/input/InputControlBar.tsx'),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/input/InputArea.module.css'),
      'utf8',
    );

    expect(inputAreaSource).not.toMatch(/<textarea/);
    expect(inputAreaSource).not.toMatch(/goal-editor/);
    expect(inputAreaSource).toMatch(/if \(goalEditing\) return t\('input\.goalPlaceholder'\)/);
    expect(inputAreaSource).toMatch(/sendGoalSubmitPrompt\(await saveGoalFromEditor\(\)\)/);
    expect(inputAreaSource).toMatch(/buildGoalStartPrompt\(result\.objective, t\)/);
    expect(inputAreaSource).toMatch(/buildGoalUpdatePrompt\(result\.objective, t\)/);
    expect(inputAreaSource).toMatch(/type:\s*allowStreaming && isStreaming \? 'interrupt_prompt' : 'prompt'/);
    expect(inputAreaSource).toMatch(/styles\['goal-active-bar'\]/);
    expect(inputAreaSource.indexOf("styles['goal-active-bar']")).toBeLessThan(
      inputAreaSource.indexOf("styles['input-wrapper']"),
    );
    expect(inputAreaSource).toMatch(/sessionGoal\?\.status === 'blocked'/);
    expect(inputAreaSource).toMatch(/goal\.status === 'blocked'[\s\S]*'input\.blockedGoal'/);
    expect(inputAreaSource).toMatch(/goal\.status === 'paused'[\s\S]*'input\.pausedGoal'/);
    expect(inputAreaSource).toMatch(/styles\['goal-active-main'\]/);
    expect(inputAreaSource).toMatch(/styles\['goal-active-actions'\]/);
    expect(inputAreaSource).toMatch(/GoalActionIcon kind="edit"/);
    expect(inputAreaSource).toMatch(/GoalActionIcon kind="review"/);
    expect(inputAreaSource).toMatch(/GoalActionIcon kind="delete"/);
    expect(inputAreaSource).toMatch(/onClear=\{manuallyClearGoal\}/);
    expect(inputAreaSource).toMatch(/onReview=\{askAgentToReviewGoal\}/);
    expect(inputAreaSource).not.toMatch(/sendLabel=\{goalEditing/);
    expect(inputAreaSource).not.toMatch(/sendTitle=\{goalEditing/);
    expect(inputAreaSource).not.toMatch(/t\('input\.goalSave'\)/);
    expect(inputAreaSource).toMatch(/onGoalClose=\{cancelGoalEditing\}/);
    expect(controlBarSource).toMatch(/styles\['goal-chip'\]/);
    expect(controlBarSource).toMatch(/forceSend=\{goalEditing\}/);
    expect(controlBarSource).not.toMatch(/add-menu-item'\]\}\s+\$\{goalActive/);
    expect(controlBarSource).toMatch(/aria-pressed=\{goalEditing\}/);
    expect(controlBarSource).toMatch(/if \(goalEditing\) onGoalClose\(\);[\s\S]*else onGoalOpen\(\);/);
    expect(controlBarSource).toMatch(/styles\['add-menu-switch'\][\s\S]*goalEditing \? styles\.on/);
    expect(controlBarSource).toMatch(/title=\{goalSaving \? t\('input\.goalSaving'\) : t\('input\.goalCancel'\)\}/);
    expect(controlBarSource).toMatch(/onClick=\{onGoalClose\}/);
    expect(controlBarSource).toMatch(/styles\['goal-chip-icon-stack'\]/);
    expect(controlBarSource).toMatch(/function AttachFileIcon\(\)/);
    expect(controlBarSource).toMatch(/<AttachFileIcon \/>[\s\S]*t\('input\.attachFiles'\)/);
    expect(controlBarSource).toMatch(/M9\.85 4\.25v6\.08/);
    expect(controlBarSource).not.toMatch(/M5\.1 8\.52|m13\.8 7\.28-5\.64 5\.64/);
    expect(controlBarSource).toMatch(/<circle className=\{styles\['goal-icon-target-outer'\]\} cx="7" cy="9" r="5\.35" \/>/);
    expect(controlBarSource).toMatch(/<circle className=\{styles\['goal-icon-target-middle'\]\} cx="7" cy="9" r="3\.2" \/>/);
    expect(controlBarSource).toMatch(/<circle className=\{styles\['goal-icon-target-center'\]\} cx="7" cy="9" r="1\.05" \/>/);
    expect(controlBarSource).not.toMatch(/A5\.75|A3\.18/);
    expect(controlBarSource).toMatch(/styles\['add-menu-icon'\][\s\S]*<GoalIcon tone="plain" \/>[\s\S]*t\('input\.goalMode'\)/);
    expect(controlBarSource).toMatch(/<GoalIcon tone="active" \/>[\s\S]*<GoalCancelIcon \/>/);
    expect(controlBarSource.indexOf('<PlanModeButton')).toBeLessThan(
      controlBarSource.indexOf("styles['goal-chip']"),
    );
    expect(controlBarSource.indexOf("styles['goal-chip']")).toBeLessThan(
      controlBarSource.indexOf('<ContextRing />'),
    );
    expect(css).toMatch(/\.goal-chip\s*\{/);
    expect(css).toMatch(/\.goal-active-bar\s*\{/);
    expect(css).toMatch(/\.goal-active-main\s*\{/);
    expect(css).toMatch(/\.goal-active-actions\s*\{/);
    expect(css).toMatch(/\.goal-active-action-danger:hover/);
    expect(css).toMatch(/\.add-menu-icon\s*\{[\s\S]*width:\s*16px[\s\S]*height:\s*16px/);
    expect(css).toMatch(/\.add-menu-item\.active \.add-menu-icon\s*\{[\s\S]*color:\s*var\(--text\)/);
    expect(css).toMatch(/\.goal-icon-target-outer,[\s\S]*\.goal-icon-arrow\s*\{[\s\S]*fill:\s*none/);
    expect(css).toMatch(/\.goal-icon-active\s*\{/);
    expect(css).toMatch(/\.goal-icon-active\s*\{[\s\S]*color:\s*#2130b5/);
    expect(css).toMatch(/\.goal-chip\s*\{[\s\S]*background:\s*transparent/);
    expect(css).not.toMatch(/#9fc0ff/);
    expect(css).toMatch(/\.add-menu-switch\.on/);
    expect(css).toMatch(/\.add-menu-switch\.on\s*\{[\s\S]*background:\s*#2130b5/);
    expect(css).toMatch(/\.goal-chip-icon-stack\s+\.goal-chip-close-icon\s*\{[\s\S]*opacity:\s*0/);
    expect(css).toMatch(/\.goal-chip:hover:not\(:disabled\) \.goal-chip-icon-stack \.goal-chip-close-icon\s*\{[\s\S]*opacity:\s*1/);
    expect(css).not.toMatch(/\.goal-editor\s*\{/);
  });

  it('keeps markdown code blocks wired to scrollbars and tables wired to clipped-cell tooltips', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/MarkdownContent.tsx'),
      'utf8',
    );

    expect(source).toMatch(/enhanceCodeBlockScrollbars/);
    expect(source).toMatch(/enhanceTableCellTooltips/);
    expect(source).toMatch(/data-md-horizontal-scrollbar/);
    expect(source).toMatch(/styles\.markdownCodeScrollbar/);
    expect(source).toMatch(/styles\.markdownCodeScrollbarThumb/);
    expect(source).toMatch(/styles\.markdownCellTooltip/);
    expect(source).toMatch(/md-table-overflowing/);
    expect(source).toMatch(/mdCellTruncated/);
    expect(source).toContain("root.querySelectorAll<HTMLElement>('.md-table-wrapper')");
    expect(source).toMatch(/scroller\.scrollWidth\s*>\s*scroller\.clientWidth\s*\+\s*1/);
    expect(source).toMatch(/scroller\.scrollLeft\s*=/);
    expect(source).toMatch(/cell\.scrollWidth\s*>\s*cell\.clientWidth\s*\+\s*1/);
  });
});
