import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computerUseHelperAppExecutablePath,
  computerUseHelperAppName,
  createComputerUseHelperAppBundle,
  computerUseHelperOutputDir,
  patchCuaDriverAppStateSource,
  patchCuaDriverAgentCursorSource,
  patchCuaDriverCheckPermissionsToolSource,
  patchCuaDriverClickToolSource,
  patchCuaDriverDragToolSource,
  patchCuaDriverGetWindowStateToolSource,
  patchCuaDriverPermissionsSource,
  resolveComputerUseHelperBuildArch,
  shouldBuildComputerUseHelper,
  swiftBuildScratchPath,
  swiftArchForNodeArch,
} from "../scripts/build-computer-use-helper.mjs";

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-computer-use-helper-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Computer Use helper build script", () => {
  it("skips the Swift helper build outside macOS", () => {
    expect(shouldBuildComputerUseHelper({ platform: "linux" })).toBe(false);
    expect(shouldBuildComputerUseHelper({ platform: "win32" })).toBe(false);
    expect(shouldBuildComputerUseHelper({ platform: "darwin" })).toBe(true);
  });

  it("maps Node architecture names to Swift architecture names", () => {
    expect(swiftArchForNodeArch("arm64")).toBe("arm64");
    expect(swiftArchForNodeArch("x64")).toBe("x86_64");
  });

  it("lets CI choose the helper build architecture explicitly", () => {
    expect(resolveComputerUseHelperBuildArch({
      argv: ["node", "scripts/build-computer-use-helper.mjs", "x64"],
      env: { HANA_COMPUTER_USE_HELPER_ARCH: "arm64" },
      arch: "arm64",
    })).toBe("x64");
    expect(resolveComputerUseHelperBuildArch({
      argv: ["node", "scripts/build-computer-use-helper.mjs"],
      env: { HANA_COMPUTER_USE_HELPER_ARCH: "x64" },
      arch: "arm64",
    })).toBe("x64");
  });

  it("writes the macOS helper into the Electron extraResources source directory", () => {
    expect(computerUseHelperOutputDir({
      rootDir: "/repo",
      osName: "mac",
      arch: "arm64",
    })).toBe(path.join("/repo", "dist-computer-use", "mac-arm64"));
  });

  it("creates a dedicated Computer Use app bundle for macOS TCC grants", () => {
    const dir = makeTempDir();
    const source = path.join(dir, "source-helper");
    fs.writeFileSync(source, "#!/bin/sh\n");
    fs.chmodSync(source, 0o755);

    const app = createComputerUseHelperAppBundle({ outputDir: dir, sourceBinary: source });
    const executable = computerUseHelperAppExecutablePath(dir);
    const info = fs.readFileSync(path.join(dir, computerUseHelperAppName(), "Contents", "Info.plist"), "utf8");

    expect(app.executable).toBe(executable);
    expect(fs.existsSync(executable)).toBe(true);
    expect(fs.statSync(executable).mode & 0o111).not.toBe(0);
    expect(info).toContain("<string>com.hanakopro.computer-use</string>");
    expect(info).toContain("<key>LSUIElement</key>");
  });

  it("keeps SwiftPM checkouts in the ignored cache directory instead of the source tree", () => {
    expect(swiftBuildScratchPath({
      rootDir: "/repo",
      arch: "arm64",
    })).toBe(path.join("/repo", ".cache", "computer-use-helper", "swift-build", "mac-arm64"));
  });

  it("patches Cua AppState snapshots to stay bounded and AX-safe", () => {
    const source = `extension AXObserver: @retroactive @unchecked Sendable {}

/// No-op callback
    public static let maxDepth = 25
        let root = AXUIElementCreateApplication(pid)

        // Cue Chromium/Electron apps to turn on their web accessibility tree.
        // Non-Chromium apps ignore these attribute writes — safe no-op.
        try await activateAccessibilityIfNeeded(pid: pid, root: root)
    private func activateAccessibilityIfNeeded(
        pid: Int32,
        root: AXUIElement
    ) async throws {
        // Already did the one-shot pump + observer for this pid.
        pumpRunLoopForActivation(duration: 0.5)
    }

    /// Pump the current thread's CFRunLoop for roughly \`duration\` seconds.
    ) {
        guard depth <= AppStateEngine.maxDepth else { return }

        let role = attributeString(element, "AXRole") ?? "?"
        let enabled = attributeBool(element, "AXEnabled")
        let actions = actionNames(of: element)

        let indent = String(repeating: "  ", count: depth)
        line += role
        if let t = title, !t.isEmpty { line += " \\"\\(t)\\"" }
        if let v = value, !v.isEmpty, v.count < 120 { line += " = \\"\\(v)\\"" }
    private func windows(of appRoot: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
    private func isMenuOpen(_ menu: AXUIElement) -> Bool {
        var value: CFTypeRef?
    private func attributeString(_ element: AXUIElement, _ attribute: String) -> String? {
        var value: CFTypeRef?
    private func attributeBool(_ element: AXUIElement, _ attribute: String) -> Bool? {
        var value: CFTypeRef?
    private func actionNames(of element: AXUIElement) -> [String] {
        var names: CFArray?
    private func children(of element: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
    /// Standard AX actions come through as simple strings like \`AXPress\`.
`;

    const patched = patchCuaDriverAppStateSource(source);

    expect(patched).toContain("cuaDriverAXMessagingTimeoutSeconds");
    expect(patched).toContain("public static let maxDepth = 6");
    expect(patched).toContain("public static let maxActionableElements = 48");
    expect(patched).toContain("shouldAssertAccessibilityForAXClientSignals");
    expect(patched).toContain("descendantLabelSummary");
    expect(patchCuaDriverAppStateSource(patched)).toBe(patched);
  });

  it("patches Cua ClickTool to expose AXShowDefaultUI as a semantic action", () => {
    const source = `Other values:
                  \`show_menu\` (right-click equivalent), \`pick\` (open a
                    "action": [
                        "type": "string",
                        "enum": ["press", "show_menu", "pick", "confirm", "cancel", "open"],
                        "description":
                            "AX action name (element_index path only). Default: press.",
                    ],
    private static let axActionByName: [String: String] = [
        "press": "AXPress",
        "show_menu": "AXShowMenu",
        "pick": "AXPick",
        "confirm": "AXConfirm",
        "cancel": "AXCancel",
        "open": "AXOpen",
    ]
`;

    const patched = patchCuaDriverClickToolSource(source);

    expect(patched).toContain('"show_default_ui"');
    expect(patched).toContain('"show_default_ui": "AXShowDefaultUI"');
    expect(patchCuaDriverClickToolSource(patched)).toBe(patched);
  });

  it("patches Cua get_window_state to park the cursor in observed target windows", () => {
    const source = `import CuaDriverCore
import Foundation
import MCP

public enum GetWindowStateTool {
        invoke: { arguments in
            if window.pid != pid {
                return errorResult(
                    "window_id \\(windowId) belongs to pid \\(window.pid), not pid "
                    + "\\(rawPid). Call \`list_windows({pid: \\(rawPid)})\` to get this "
                    + "pid's own windows.")
            }

            // Re-read the persisted capture_mode on every invocation so a
        }

    /// Mode-aware summary block. First line is always a ✅ headline with
    private static func buildSummary() {}
}
`;

    const patched = patchCuaDriverGetWindowStateToolSource(source);

    expect(patched).toContain("import CoreGraphics");
    expect(patched).toContain("hanaParkAgentCursorInObservedWindow");
    expect(patched).toContain("AgentCursor.shared.pinAbove(pid: pid, windowId: window.id)");
    expect(patched).toContain("window.isOnScreen");
    expect(patched).toContain("AgentCursor.shared.setPosition(point)");
    expect(patched).toContain("AgentCursor.shared.show()");
    expect(patched).toContain("reappears inside the same app");
    expect(patchCuaDriverGetWindowStateToolSource(patched)).toBe(patched);
  });

  it("patches Cua AgentCursor to keep minimized targets bound without drifting onto the desktop", () => {
    const source = `    public func show() {
        guard isEnabled else { return }
        let win = ensureWindow()
        if !win.isVisible {
            win.orderFrontRegardless()
        }
    }

    public func pinAbove(pid: pid_t) {
        guard isEnabled else { return }
        pinnedPid = pid
        missedPinCount = 0  // fresh pin — any earlier miss streak is stale
        ensureActivationObserver()
        reapplyPinAbove()
        startContinuousRepin()
    }

    private func reapplyPinAbove() {
        guard isEnabled, let pid = pinnedPid else { return }
        let win = ensureWindow()
        let targetWindow = WindowEnumerator.visibleWindows()
            .filter { $0.pid == pid && $0.layer == 0 && $0.isOnScreen }
            .max(by: { $0.zIndex < $1.zIndex })

            // Target has no on-screen window — it's minimized, hidden,
            // or on another Space. Drop the overlay entirely rather
            // than floating it above other apps: there's nothing to
            // pin above, and showing a stranded cursor over the user's
            // actual frontmost app is worse than nothing.
            //
            // BUT — a single missed tick is usually just a mid-raise
            // frame where \`visibleWindows()\` transiently returns no
            // match. Hiding on the first miss caused the overlay to
            // vanish for ~1s during every click. Require ≥2
            // consecutive misses before hiding; the next scheduled
            // repin tick (60–300ms later) will catch the window
            // once it's back on screen and reset the counter.
            missedPinCount += 1
            if missedPinCount >= 2 {
                if win.isVisible { win.orderOut(nil) }
                pinnedWindowId = nil
            }
            return
        guard let targetWindow else { return }
        win.order(.above, relativeTo: targetWindow.id)
        pinnedWindowId = targetWindow.id
    }

    public func finishClick(pid: pid_t) async {
        _ = pid  // reserved for future per-pid dwell / hide policy
        guard isEnabled else { return }
    }
`;

    const patched = patchCuaDriverAgentCursorSource(source);

    expect(patched).toContain("Hana keeps the target binding alive while minimized");
    expect(patched).toContain("hanaPinnedTargetIsVisible");
    expect(patched).toContain("hanaPinnedWindowBindingIsVisible");
    expect(patched).toContain("hanaHideIfPinnedTargetUnavailable");
    expect(patched).toContain("if hanaHideIfPinnedTargetUnavailable() { return }");
    expect(patched).toContain("public func pinAbove(pid: pid_t, windowId: Int? = nil)");
    expect(patched).toContain("pinnedWindowId == nil || window.id == pinnedWindowId");
    expect(patched).toContain("if win.isVisible { win.orderOut(nil) }");
    expect(patched).toContain("WindowEnumerator.visibleWindows()");
    expect(patched).not.toContain("pinnedWindowId = nil");
    expect(patched).not.toContain("pinnedPid = nil");
    expect(patchCuaDriverAgentCursorSource(patched)).toBe(patched);
  });

  it("patches pointer tools to keep the native cursor bound to the target window", () => {
    const clickSource = `private static func performElementClick(
        pid: Int32, windowId: UInt32, index: Int, actionName: String
    ) async -> CallTool.Result {
            if let center = AXInput.screenCenter(of: element) {
                await MainActor.run {
                    AgentCursor.shared.pinAbove(pid: pid)
                }
            }
            await AgentCursor.shared.finishClick(pid: pid)
    }
    private static func performPixelClick(
        pid: Int32, windowId: UInt32?
    ) async -> CallTool.Result {
            if let index = elementIndex, let windowId {
                return await performElementClick(pid: pid, windowId: windowId, index: index, actionName: actionName ?? "press")
            }
            await MainActor.run {
                AgentCursor.shared.pinAbove(pid: pid)
            }
            await AgentCursor.shared.finishClick(pid: pid)
    }
`;
    const dragSource = `        await MainActor.run {
            AgentCursor.shared.pinAbove(pid: pid)
        }
        await AgentCursor.shared.finishClick(pid: pid)
`;

    const patchedClick = patchCuaDriverClickToolSource(clickSource);
    const patchedDrag = patchCuaDriverDragToolSource(dragSource);

    expect(patchedClick).toContain("AgentCursor.shared.pinAbove(pid: pid, windowId: windowId.map { Int($0) })");
    expect(patchedClick).toContain("AgentCursor.shared.pinAbove(pid: pid, windowId: Int(windowId))");
    expect(patchedClick).toContain("AgentCursor.shared.finishClick(pid: pid, windowId: windowId.map { Int($0) })");
    expect(patchedClick).toContain("AgentCursor.shared.finishClick(pid: pid, windowId: Int(windowId))");
    expect(patchedDrag).toContain("AgentCursor.shared.pinAbove(pid: pid, windowId: windowId.map { Int($0) })");
    expect(patchedDrag).toContain("AgentCursor.shared.finishClick(pid: pid, windowId: windowId.map { Int($0) })");
  });

  it("patches Cua permissions so read-only status checks avoid ScreenCaptureKit probes", () => {
    const permissionsSource = `public enum Permissions {
    /// Accurate TCC status for both grants.

    /// Accessibility uses \`AXIsProcessTrusted()\` — reliable.
    public static func currentStatus() async -> PermissionsStatus {
        async let screen = probeScreenRecording()
        return await PermissionsStatus(
            accessibility: AXIsProcessTrusted(),
            screenRecording: screen
        )
    }
`;
    const toolSource = `                Report TCC permission status for Accessibility and Screen Recording.
                By default also raises the system permission dialogs for any missing
                grants — Apple's request APIs are no-ops when the grant is already
                active, so this is safe to call repeatedly. Pass {"prompt": false}
                for a purely read-only status check.
            let status = await Permissions.currentStatus()
`;

    const patchedPermissions = patchCuaDriverPermissionsSource(permissionsSource);
    const patchedTool = patchCuaDriverCheckPermissionsToolSource(toolSource);

    expect(patchedPermissions).toContain("preflightStatus");
    expect(patchedPermissions).toContain("CGPreflightScreenCaptureAccess()");
    expect(patchedTool).toContain("Permissions.preflightStatus()");
    expect(patchedTool).toContain("avoids ScreenCaptureKit probes");
    expect(patchCuaDriverPermissionsSource(patchedPermissions)).toBe(patchedPermissions);
    expect(patchCuaDriverCheckPermissionsToolSource(patchedTool)).toBe(patchedTool);
  });
});
