import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function shouldBuildComputerUseHelper({ platform = process.platform } = {}) {
  return platform === "darwin";
}

export function swiftArchForNodeArch(arch = process.arch) {
  if (arch === "x64") return "x86_64";
  return arch;
}

export function resolveComputerUseHelperBuildArch({
  argv = process.argv,
  env = process.env,
  arch = process.arch,
} = {}) {
  const explicitArg = Array.isArray(argv) ? argv[2] : null;
  return explicitArg || env.HANA_COMPUTER_USE_HELPER_ARCH || arch;
}

export function computerUseHelperOutputDir({
  rootDir = path.resolve(__dirname, ".."),
  osName = "mac",
  arch = process.arch,
} = {}) {
  return path.join(rootDir, "dist-computer-use", `${osName}-${arch}`);
}

export function computerUseHelperAppName() {
  return "Hanako Computer Use.app";
}

export function computerUseHelperAppPath(outputDir) {
  return path.join(outputDir, computerUseHelperAppName());
}

export function computerUseHelperAppExecutablePath(outputDir) {
  return path.join(computerUseHelperAppPath(outputDir), "Contents", "MacOS", "hana-computer-use-helper");
}

function escapePlistString(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createComputerUseHelperAppBundle({ outputDir, sourceBinary }) {
  const appPath = computerUseHelperAppPath(outputDir);
  const contentsDir = path.join(appPath, "Contents");
  const macosDir = path.join(contentsDir, "MacOS");
  fs.rmSync(appPath, { recursive: true, force: true });
  fs.mkdirSync(macosDir, { recursive: true });

  const executable = path.join(macosDir, "hana-computer-use-helper");
  fs.copyFileSync(sourceBinary, executable);
  fs.chmodSync(executable, 0o755);

  const info = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>hana-computer-use-helper</string>
  <key>CFBundleIdentifier</key>
  <string>com.hanakopro.computer-use</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${escapePlistString(computerUseHelperAppName().replace(/\.app$/, ""))}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(contentsDir, "Info.plist"), info);
  return { appPath, executable };
}

export function swiftBuildScratchPath({
  rootDir = path.resolve(__dirname, ".."),
  arch = process.arch,
} = {}) {
  return path.join(rootDir, ".cache", "computer-use-helper", "swift-build", `mac-${arch}`);
}

const CUA_APP_STATE_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverCore",
  "AppState",
  "AppState.swift",
);
const CUA_CLICK_TOOL_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverServer",
  "Tools",
  "ClickTool.swift",
);
const CUA_DRAG_TOOL_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverServer",
  "Tools",
  "DragTool.swift",
);
const CUA_GET_WINDOW_STATE_TOOL_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverServer",
  "Tools",
  "GetWindowStateTool.swift",
);
const CUA_PERMISSIONS_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverCore",
  "Permissions",
  "Permissions.swift",
);
const CUA_CHECK_PERMISSIONS_TOOL_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverServer",
  "Tools",
  "CheckPermissionsTool.swift",
);
const CUA_AGENT_CURSOR_RELATIVE_PATH = path.join(
  "checkouts",
  "cua",
  "libs",
  "cua-driver",
  "Sources",
  "CuaDriverCore",
  "Cursor",
  "AgentCursor.swift",
);

const CUA_AX_PATCH_SENTINEL = "cuaDriverAXMessagingTimeoutSeconds";
const CUA_CLICK_PATCH_SENTINEL = '"show_default_ui": "AXShowDefaultUI"';
const CUA_GET_WINDOW_STATE_CURSOR_PATCH_SENTINEL = "hanaParkAgentCursorInObservedWindow";
const CUA_PERMISSIONS_PATCH_SENTINEL = "static func preflightStatus() -> PermissionsStatus";
const CUA_CHECK_PERMISSIONS_PATCH_SENTINEL = "Permissions.preflightStatus()";
const CUA_AGENT_CURSOR_PATCH_SENTINEL = "hanaPinnedTargetIsVisible";
const CUA_AGENT_CURSOR_WINDOW_PIN_SENTINEL = "hanaPinnedWindowBindingIsVisible";
const CUA_AGENT_CURSOR_VISIBILITY_GUARD_SENTINEL = "hanaHideIfPinnedTargetUnavailable";

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`[computer-use-helper] Cua patch anchor not found: ${label}`);
  }
  return source.replace(needle, replacement);
}

function replaceIfPresent(source, needle, replacement) {
  return source.includes(needle) ? source.replace(needle, replacement) : source;
}

export function patchCuaDriverAppStateSource(source) {
  if (source.includes(CUA_AX_PATCH_SENTINEL)) return source;
  let patched = source;

  patched = replaceRequired(
    patched,
    "extension AXObserver: @retroactive @unchecked Sendable {}\n\n/// No-op callback",
    `extension AXObserver: @retroactive @unchecked Sendable {}

private let cuaDriverAXMessagingTimeoutSeconds: Float = 0.35

@discardableResult
private func applyCuaDriverAXMessagingTimeout(_ element: AXUIElement) -> AXError {
    AXUIElementSetMessagingTimeout(element, cuaDriverAXMessagingTimeoutSeconds)
}

/// No-op callback`,
    "AX messaging timeout helpers",
  );

  patched = replaceRequired(
    patched,
    "    public static let maxDepth = 25\n",
    "    public static let maxDepth = 6\n    public static let maxActionableElements = 48\n",
    "bounded AX tree walk",
  );

  patched = replaceRequired(
    patched,
    `        let root = AXUIElementCreateApplication(pid)

        // Cue Chromium/Electron apps to turn on their web accessibility tree.
        // Non-Chromium apps ignore these attribute writes — safe no-op.
        try await activateAccessibilityIfNeeded(pid: pid, root: root)
`,
    `        let root = AXUIElementCreateApplication(pid)
        applyCuaDriverAXMessagingTimeout(root)

        // Cue Chromium/Electron apps to turn on their web accessibility tree.
        // Native AppKit apps can stall on the AXManualAccessibility writes, so
        // keep this Chromium-only instead of probing every app optimistically.
        try await activateAccessibilityIfNeeded(
            pid: pid,
            root: root,
            bundleId: running.bundleIdentifier
        )
`,
    "safe accessibility activation call",
  );

  patched = replaceRequired(
    patched,
    `    private func activateAccessibilityIfNeeded(
        pid: Int32,
        root: AXUIElement
    ) async throws {
        // Already did the one-shot pump + observer for this pid.
`,
    `    private func activateAccessibilityIfNeeded(
        pid: Int32,
        root: AXUIElement,
        bundleId: String?
    ) async throws {
        guard shouldAssertAccessibilityForAXClientSignals(
            pid: pid,
            bundleId: bundleId
        ) else { return }
        // Already did the one-shot pump + observer for this pid.
`,
    "Chromium-only accessibility activation signature",
  );

  patched = replaceRequired(
    patched,
    `        pumpRunLoopForActivation(duration: 0.5)
    }

    /// Pump the current thread's CFRunLoop for roughly \`duration\` seconds.
`,
    `        pumpRunLoopForActivation(duration: 0.5)
    }

    private nonisolated func shouldAssertAccessibilityForAXClientSignals(
        pid: Int32,
        bundleId: String?
    ) -> Bool {
        if ElectronJS.isElectron(pid: pid) { return true }
        switch bundleId {
        case "com.google.Chrome",
             "com.google.Chrome.canary",
             "com.microsoft.edgemac",
             "com.microsoft.edgemac.Canary",
             "com.brave.Browser",
             "com.operasoftware.Opera",
             "com.vivaldi.Vivaldi":
            return true
        default:
            return false
        }
    }

    /// Pump the current thread's CFRunLoop for roughly \`duration\` seconds.
`,
    "Chromium app detection helper",
  );

  patched = replaceRequired(
    patched,
    `    ) {
        guard depth <= AppStateEngine.maxDepth else { return }

        let role = attributeString(element, "AXRole") ?? "?"
`,
    `    ) {
        guard depth <= AppStateEngine.maxDepth else { return }
        guard nextIndex < AppStateEngine.maxActionableElements else { return }
        applyCuaDriverAXMessagingTimeout(element)

        let role = attributeString(element, "AXRole") ?? "?"
`,
    "renderTree guard",
  );

  patched = replaceRequired(
    patched,
    `        let enabled = attributeBool(element, "AXEnabled")
        let actions = actionNames(of: element)

        let indent = String(repeating: "  ", count: depth)
`,
    `        let enabled = attributeBool(element, "AXEnabled")
        let actions = actionNames(of: element)
        let descendantSummary =
            (role == "AXRow" && (title?.isEmpty ?? true) && (value?.isEmpty ?? true) && (description?.isEmpty ?? true))
            ? descendantLabelSummary(of: element)
            : nil

        let indent = String(repeating: "  ", count: depth)
`,
    "AXRow descendant summary",
  );

  patched = replaceRequired(
    patched,
    `        line += role
        if let t = title, !t.isEmpty { line += " \\"\\(t)\\"" }
        if let v = value, !v.isEmpty, v.count < 120 { line += " = \\"\\(v)\\"" }
`,
    `        line += role
        if let t = title, !t.isEmpty { line += " \\"\\(t)\\"" }
        else if let s = descendantSummary, !s.isEmpty { line += " \\"\\(s)\\"" }
        if let v = value, !v.isEmpty, v.count < 120 { line += " = \\"\\(v)\\"" }
`,
    "AXRow label rendering",
  );

  for (const [needle, replacement, label] of [
    [
      `    private func windows(of appRoot: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
`,
      `    private func windows(of appRoot: AXUIElement) -> [AXUIElement] {
        applyCuaDriverAXMessagingTimeout(appRoot)
        var value: CFTypeRef?
`,
      "AX timeout for windows",
    ],
    [
      `    private func isMenuOpen(_ menu: AXUIElement) -> Bool {
        var value: CFTypeRef?
`,
      `    private func isMenuOpen(_ menu: AXUIElement) -> Bool {
        applyCuaDriverAXMessagingTimeout(menu)
        var value: CFTypeRef?
`,
      "AX timeout for menu visibility",
    ],
    [
      `    private func attributeString(_ element: AXUIElement, _ attribute: String) -> String? {
        var value: CFTypeRef?
`,
      `    private func attributeString(_ element: AXUIElement, _ attribute: String) -> String? {
        applyCuaDriverAXMessagingTimeout(element)
        var value: CFTypeRef?
`,
      "AX timeout for string attributes",
    ],
    [
      `    private func attributeBool(_ element: AXUIElement, _ attribute: String) -> Bool? {
        var value: CFTypeRef?
`,
      `    private func attributeBool(_ element: AXUIElement, _ attribute: String) -> Bool? {
        applyCuaDriverAXMessagingTimeout(element)
        var value: CFTypeRef?
`,
      "AX timeout for boolean attributes",
    ],
    [
      `    private func actionNames(of element: AXUIElement) -> [String] {
        var names: CFArray?
`,
      `    private func actionNames(of element: AXUIElement) -> [String] {
        applyCuaDriverAXMessagingTimeout(element)
        var names: CFArray?
`,
      "AX timeout for action names",
    ],
    [
      `    private func children(of element: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
`,
      `    private func children(of element: AXUIElement) -> [AXUIElement] {
        applyCuaDriverAXMessagingTimeout(element)
        var value: CFTypeRef?
`,
      "AX timeout for children",
    ],
  ]) {
    patched = replaceRequired(patched, needle, replacement, label);
  }

  patched = replaceRequired(
    patched,
    `    /// Standard AX actions come through as simple strings like \`AXPress\`.
`,
    `    private func descendantLabelSummary(of element: AXUIElement) -> String? {
        var labels: [String] = []
        collectDescendantLabels(element, depth: 0, maxDepth: 2, labels: &labels)
        let joined = labels
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(4)
            .joined(separator: " ")
        return joined.isEmpty ? nil : joined
    }

    private func collectDescendantLabels(
        _ element: AXUIElement,
        depth: Int,
        maxDepth: Int,
        labels: inout [String]
    ) {
        if labels.count >= 4 || depth > maxDepth { return }
        let role = attributeString(element, "AXRole") ?? ""
        if role == "AXStaticText" || role == "AXButton" || role == "AXImage" {
            for attribute in ["AXTitle", "AXValue", "AXDescription"] {
                if let text = attributeString(element, attribute), !text.isEmpty {
                    labels.append(text)
                    if labels.count >= 4 { return }
                    break
                }
            }
        }
        if depth == maxDepth { return }
        for child in children(of: element) {
            collectDescendantLabels(child, depth: depth + 1, maxDepth: maxDepth, labels: &labels)
            if labels.count >= 4 { return }
        }
    }

    /// Standard AX actions come through as simple strings like \`AXPress\`.
`,
    "AXRow descendant label helpers",
  );

  return patched;
}

export function patchCuaDriverClickToolSource(source) {
  let patched = source;

  if (!patched.includes(CUA_CLICK_PATCH_SENTINEL) && patched.includes(`"enum": ["press", "show_menu", "pick", "confirm", "cancel", "open"],`)) {
    patched = replaceRequired(
      patched,
      `"enum": ["press", "show_menu", "pick", "confirm", "cancel", "open"],`,
      `"enum": ["press", "show_menu", "show_default_ui", "pick", "confirm", "cancel", "open"],`,
      "ClickTool action schema",
    );

    patched = replaceRequired(
      patched,
      `"show_menu": "AXShowMenu",
        "pick": "AXPick",`,
      `"show_menu": "AXShowMenu",
        "show_default_ui": "AXShowDefaultUI",
        "pick": "AXPick",`,
      "ClickTool AXShowDefaultUI action mapping",
    );

    patched = replaceRequired(
      patched,
      "Other values:\n                  `show_menu` (right-click equivalent), `pick` (open a",
      "Other values:\n                  `show_menu` (right-click equivalent), `show_default_ui`\n                  (select a row/list item via AXShowDefaultUI), `pick` (open a",
      "ClickTool action description",
    );
  }

  patched = patched.replaceAll("AgentCursor.shared.pinAbove(pid: pid)", "AgentCursor.shared.pinAbove(pid: pid, windowId: windowId.map { Int($0) })");
  patched = patched.replaceAll("AgentCursor.shared.finishClick(pid: pid)", "AgentCursor.shared.finishClick(pid: pid, windowId: windowId.map { Int($0) })");

  const elementClickStart = patched.indexOf("private static func performElementClick(");
  const pixelClickStart = patched.indexOf("private static func performPixelClick(");
  if (elementClickStart !== -1) {
    const elementClickEnd = pixelClickStart === -1 ? patched.length : pixelClickStart;
    const before = patched.slice(0, elementClickStart);
    const elementClick = patched
      .slice(elementClickStart, elementClickEnd)
      .replaceAll("AgentCursor.shared.pinAbove(pid: pid, windowId: windowId.map { Int($0) })", "AgentCursor.shared.pinAbove(pid: pid, windowId: Int(windowId))")
      .replaceAll("AgentCursor.shared.finishClick(pid: pid, windowId: windowId.map { Int($0) })", "AgentCursor.shared.finishClick(pid: pid, windowId: Int(windowId))");
    const after = patched.slice(elementClickEnd);
    patched = `${before}${elementClick}${after}`;
  }

  return patched;
}

export function patchCuaDriverDragToolSource(source) {
  return source
    .replaceAll("AgentCursor.shared.pinAbove(pid: pid)", "AgentCursor.shared.pinAbove(pid: pid, windowId: windowId.map { Int($0) })")
    .replaceAll("AgentCursor.shared.finishClick(pid: pid)", "AgentCursor.shared.finishClick(pid: pid, windowId: windowId.map { Int($0) })");
}

export function patchCuaDriverGetWindowStateToolSource(source) {
  let patched = source;

  if (!patched.includes("import CoreGraphics")) {
    patched = replaceRequired(
      patched,
      `import CuaDriverCore
import Foundation
import MCP
`,
      `import CoreGraphics
import CuaDriverCore
import Foundation
import MCP
`,
      "get_window_state cursor parking import",
    );
  }

  if (!patched.includes("await hanaParkAgentCursorInObservedWindow(pid: pid, window: window)")) {
    patched = replaceRequired(
      patched,
      `            if window.pid != pid {
                return errorResult(
                    "window_id \\(windowId) belongs to pid \\(window.pid), not pid "
                    + "\\(rawPid). Call \`list_windows({pid: \\(rawPid)})\` to get this "
                    + "pid's own windows.")
            }

            // Re-read the persisted capture_mode on every invocation so a
`,
      `            if window.pid != pid {
                return errorResult(
                    "window_id \\(windowId) belongs to pid \\(window.pid), not pid "
                    + "\\(rawPid). Call \`list_windows({pid: \\(rawPid)})\` to get this "
                    + "pid's own windows.")
            }

            await hanaParkAgentCursorInObservedWindow(pid: pid, window: window)

            // Re-read the persisted capture_mode on every invocation so a
`,
      "get_window_state cursor parking call",
    );
  }

  if (!patched.includes("private static func hanaParkAgentCursorInObservedWindow(")) {
    patched = replaceRequired(
      patched,
      `    /// Mode-aware summary block. First line is always a ✅ headline with
`,
      `    /// Keep Hana's visible cursor bound to the app even during pure
    /// observation. Pointer tools already animate before clicks; validation
    /// often starts with read-only snapshots, so without this the cursor can
    /// remain wherever the previous action left it and look disconnected from
    /// the app being verified. If the named window is minimized/offscreen we
    /// do not show the cursor on the desktop; \`pinAbove(pid:windowId:)\`
    /// keeps the binding alive so the cursor reappears inside the same app
    /// window when restored.
    @MainActor
    private static func hanaParkAgentCursorInObservedWindow(
        pid: Int32,
        window: WindowInfo
    ) {
        AgentCursor.shared.pinAbove(pid: pid, windowId: window.id)
        guard window.isOnScreen,
              window.layer == 0,
              window.bounds.width > 1,
              window.bounds.height > 1
        else { return }

        let inset = 24.0
        let xOffset = window.bounds.width <= inset * 2
            ? window.bounds.width / 2
            : min(max(window.bounds.width * 0.5, inset), window.bounds.width - inset)
        let yOffset = window.bounds.height <= inset * 2
            ? window.bounds.height / 2
            : min(max(window.bounds.height * 0.5, inset), window.bounds.height - inset)
        let point = CGPoint(
            x: CGFloat(window.bounds.x + xOffset),
            y: CGFloat(window.bounds.y + yOffset)
        )
        AgentCursor.shared.setPosition(point)
        AgentCursor.shared.show()
    }

    /// Mode-aware summary block. First line is always a ✅ headline with
`,
      "get_window_state cursor parking helper",
    );
  } else {
    patched = patched
      .replaceAll("`pinAbove(pid:)` keeps the\n    /// binding alive so the cursor reappears inside the app when restored.", "`pinAbove(pid:windowId:)`\n    /// keeps the binding alive so the cursor reappears inside the same app\n    /// window when restored.")
      .replaceAll("AgentCursor.shared.pinAbove(pid: pid)", "AgentCursor.shared.pinAbove(pid: pid, windowId: window.id)");
  }

  return patched;
}

export function patchCuaDriverPermissionsSource(source) {
  if (source.includes(CUA_PERMISSIONS_PATCH_SENTINEL)) return source;
  let patched = source;

  patched = replaceRequired(
    patched,
    `public enum Permissions {
    /// Accurate TCC status for both grants.
`,
    `public enum Permissions {
    /// Pure read-only TCC preflight. Avoid ScreenCaptureKit probes here so a
    /// status refresh does not raise macOS's direct screen/audio consent panel.
    public static func preflightStatus() -> PermissionsStatus {
        PermissionsStatus(
            accessibility: AXIsProcessTrusted(),
            screenRecording: CGPreflightScreenCaptureAccess()
        )
    }

    /// Accurate TCC status for both grants.
`,
    "read-only permission preflight",
  );

  return patched;
}

export function patchCuaDriverCheckPermissionsToolSource(source) {
  if (source.includes(CUA_CHECK_PERMISSIONS_PATCH_SENTINEL)) return source;
  let patched = source;

  patched = replaceRequired(
    patched,
    `                Report TCC permission status for Accessibility and Screen Recording.
                By default also raises the system permission dialogs for any missing
                grants — Apple's request APIs are no-ops when the grant is already
                active, so this is safe to call repeatedly. Pass {"prompt": false}
                for a purely read-only status check.
`,
    `                Report TCC permission status for Accessibility and Screen Recording.
                By default also raises the system permission dialogs for any missing
                grants. Pass {"prompt": false} for a purely read-only preflight that
                avoids ScreenCaptureKit probes and therefore will not raise macOS's
                direct screen/audio access consent panel.
`,
    "permission tool description",
  );

  patched = replaceRequired(
    patched,
    `            let status = await Permissions.currentStatus()
`,
    `            let status = shouldPrompt
                ? await Permissions.currentStatus()
                : Permissions.preflightStatus()
`,
    "non-prompting permission status path",
  );

  return patched;
}

export function patchCuaDriverAgentCursorSource(source) {
  let patched = source;

  const minimizedOriginal = `            // Target has no on-screen window — it's minimized, hidden,
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
`;
  const minimizedReplacement = `            // Target has no on-screen window — it's minimized, hidden,
            // or on another Space. Hide the overlay so it never floats over
            // unrelated apps, but keep pinnedPid and the continuous repin loop
            // alive. Hana keeps the target binding alive while minimized: when
            // the user restores the app, the next repin tick orders the cursor
            // back above that target window instead of treating the task as
            // visually finished.
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
`;
  if (patched.includes(minimizedOriginal)) {
    patched = patched.replace(minimizedOriginal, minimizedReplacement);
  } else if (!patched.includes("Hana keeps the target binding alive while minimized")) {
    throw new Error("[computer-use-helper] Cua patch anchor not found: AgentCursor minimized target binding");
  }

  if (!patched.includes(CUA_AGENT_CURSOR_PATCH_SENTINEL)) {
    patched = replaceRequired(
      patched,
      `    public func show() {
        guard isEnabled else { return }
        let win = ensureWindow()
        if !win.isVisible {
            win.orderFrontRegardless()
        }
    }
`,
      `    public func show() {
        guard isEnabled else { return }
        let win = ensureWindow()
        if !hanaPinnedTargetIsVisible() {
            if win.isVisible { win.orderOut(nil) }
            return
        }
        if !win.isVisible {
            win.orderFrontRegardless()
        }
    }

    private func hanaPinnedTargetIsVisible() -> Bool {
        guard let pid = pinnedPid else { return true }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid && window.layer == 0 && window.isOnScreen
        }
    }
`,
      "AgentCursor pinned target show guard",
    );
  }

  if (!patched.includes(CUA_AGENT_CURSOR_WINDOW_PIN_SENTINEL)) {
    patched = replaceRequired(
      patched,
      `    public func pinAbove(pid: pid_t) {
        guard isEnabled else { return }
        pinnedPid = pid
        missedPinCount = 0  // fresh pin — any earlier miss streak is stale
        ensureActivationObserver()
        reapplyPinAbove()
        startContinuousRepin()
    }
`,
      `    public func pinAbove(pid: pid_t, windowId: Int? = nil) {
        guard isEnabled else { return }
        let targetChanged = pinnedPid != pid || pinnedWindowId != windowId
        pinnedPid = pid
        pinnedWindowId = windowId
        if targetChanged || hanaPinnedWindowBindingIsVisible() {
            missedPinCount = 0
        }
        ensureActivationObserver()
        reapplyPinAbove()
        startContinuousRepin()
    }

    private func hanaPinnedWindowBindingIsVisible() -> Bool {
        guard isEnabled, let pid = pinnedPid else { return false }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid
                && window.layer == 0
                && window.isOnScreen
                && (pinnedWindowId == nil || window.id == pinnedWindowId)
        }
    }
`,
      "AgentCursor window-specific pin",
    );

    patched = replaceRequired(
      patched,
      `    private func hanaPinnedTargetIsVisible() -> Bool {
        guard let pid = pinnedPid else { return true }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid && window.layer == 0 && window.isOnScreen
        }
    }
`,
      `    private func hanaPinnedTargetIsVisible() -> Bool {
        guard let pid = pinnedPid else { return true }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid
                && window.layer == 0
                && window.isOnScreen
                && (pinnedWindowId == nil || window.id == pinnedWindowId)
        }
    }
`,
      "AgentCursor pinned target window guard",
    );

    patched = replaceRequired(
      patched,
      `        let targetWindow = WindowEnumerator.visibleWindows()
            .filter { $0.pid == pid && $0.layer == 0 && $0.isOnScreen }
            .max(by: { $0.zIndex < $1.zIndex })
`,
      `        let targetWindow = WindowEnumerator.visibleWindows()
            .filter {
                $0.pid == pid
                    && $0.layer == 0
                    && $0.isOnScreen
                    && (pinnedWindowId == nil || $0.id == pinnedWindowId)
            }
            .max(by: { $0.zIndex < $1.zIndex })
`,
      "AgentCursor reapply target window filter",
    );

    patched = patched.replaceAll("                pinnedWindowId = nil\n", "");
  }

  patched = patched
    .replaceAll("public func finishClick(pid: pid_t) async", "public func finishClick(pid: pid_t, windowId: Int? = nil) async")
    .replaceAll("_ = pid  // reserved for future per-pid dwell / hide policy", "pinAbove(pid: pid, windowId: windowId)");

  if (!patched.includes(CUA_AGENT_CURSOR_VISIBILITY_GUARD_SENTINEL)) {
    patched = replaceRequired(
      patched,
      `    private func hanaPinnedWindowBindingIsVisible() -> Bool {
        guard isEnabled, let pid = pinnedPid else { return false }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid
                && window.layer == 0
                && window.isOnScreen
                && (pinnedWindowId == nil || window.id == pinnedWindowId)
        }
    }
`,
      `    private func hanaPinnedWindowBindingIsVisible() -> Bool {
        guard isEnabled, let pid = pinnedPid else { return false }
        return WindowEnumerator.visibleWindows().contains { window in
            window.pid == pid
                && window.layer == 0
                && window.isOnScreen
                && (pinnedWindowId == nil || window.id == pinnedWindowId)
        }
    }

    @discardableResult
    private func hanaHideIfPinnedTargetUnavailable() -> Bool {
        guard pinnedPid != nil else { return false }
        if hanaPinnedWindowBindingIsVisible() { return false }
        if let win = overlay, win.isVisible { win.orderOut(nil) }
        return true
    }
`,
      "AgentCursor pinned target unavailable hide helper",
    );

    patched = replaceRequired(
      patched,
      `    public func show() {
        guard isEnabled else { return }
        let win = ensureWindow()
        if !hanaPinnedTargetIsVisible() {
            if win.isVisible { win.orderOut(nil) }
            return
        }
        if !win.isVisible {
            win.orderFrontRegardless()
        }
    }
`,
      `    public func show() {
        guard isEnabled else { return }
        if hanaHideIfPinnedTargetUnavailable() { return }
        let win = ensureWindow()
        if !win.isVisible {
            win.orderFrontRegardless()
        }
    }
`,
      "AgentCursor show pinned target availability guard",
    );

    patched = replaceIfPresent(
      patched,
      `        let duration = duration ?? glideDurationSeconds
        cancelIdleHide()  // incoming activity — defer auto-hide
        show()  // ensure the overlay is visible; no-op if already shown
        animate(to: point)
`,
      `        let duration = duration ?? glideDurationSeconds
        cancelIdleHide()  // incoming activity — defer auto-hide
        if hanaHideIfPinnedTargetUnavailable() { return }
        show()  // ensure the overlay is visible; no-op if already shown
        if hanaHideIfPinnedTargetUnavailable() { return }
        animate(to: point)
`,
    );

    patched = replaceIfPresent(
      patched,
      `        guard isEnabled else { return }
        _ = ensureWindow()
`,
      `        guard isEnabled else { return }
        if hanaHideIfPinnedTargetUnavailable() { return }
        _ = ensureWindow()
`,
    );

    patched = replaceIfPresent(
      patched,
      `    public func playClickPress(duration: CFTimeInterval = 0.65) async {
        guard isEnabled else { return }
        try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
    }
`,
      `    public func playClickPress(duration: CFTimeInterval = 0.65) async {
        guard isEnabled else { return }
        if hanaHideIfPinnedTargetUnavailable() { return }
        try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
    }
`,
    );

    patched = replaceRequired(
      patched,
      `    public func finishClick(pid: pid_t, windowId: Int? = nil) async {
        pinAbove(pid: pid, windowId: windowId)
        guard isEnabled else { return }
`,
      `    public func finishClick(pid: pid_t, windowId: Int? = nil) async {
        pinAbove(pid: pid, windowId: windowId)
        guard isEnabled else { return }
        if hanaHideIfPinnedTargetUnavailable() { return }
`,
      "AgentCursor finishClick pinned target availability guard",
    );
  }

  return patched;
}

export function applyCuaDriverSourcePatches({ scratchPath } = {}) {
  const appStatePath = path.join(scratchPath, CUA_APP_STATE_RELATIVE_PATH);
  if (!fs.existsSync(appStatePath)) {
    throw new Error(`[computer-use-helper] Cua AppState.swift not found at ${appStatePath}`);
  }
  const clickToolPath = path.join(scratchPath, CUA_CLICK_TOOL_RELATIVE_PATH);
  if (!fs.existsSync(clickToolPath)) {
    throw new Error(`[computer-use-helper] Cua ClickTool.swift not found at ${clickToolPath}`);
  }
  const dragToolPath = path.join(scratchPath, CUA_DRAG_TOOL_RELATIVE_PATH);
  if (!fs.existsSync(dragToolPath)) {
    throw new Error(`[computer-use-helper] Cua DragTool.swift not found at ${dragToolPath}`);
  }
  const getWindowStateToolPath = path.join(scratchPath, CUA_GET_WINDOW_STATE_TOOL_RELATIVE_PATH);
  if (!fs.existsSync(getWindowStateToolPath)) {
    throw new Error(`[computer-use-helper] Cua GetWindowStateTool.swift not found at ${getWindowStateToolPath}`);
  }
  const permissionsPath = path.join(scratchPath, CUA_PERMISSIONS_RELATIVE_PATH);
  if (!fs.existsSync(permissionsPath)) {
    throw new Error(`[computer-use-helper] Cua Permissions.swift not found at ${permissionsPath}`);
  }
  const checkPermissionsToolPath = path.join(scratchPath, CUA_CHECK_PERMISSIONS_TOOL_RELATIVE_PATH);
  if (!fs.existsSync(checkPermissionsToolPath)) {
    throw new Error(`[computer-use-helper] Cua CheckPermissionsTool.swift not found at ${checkPermissionsToolPath}`);
  }
  const agentCursorPath = path.join(scratchPath, CUA_AGENT_CURSOR_RELATIVE_PATH);
  if (!fs.existsSync(agentCursorPath)) {
    throw new Error(`[computer-use-helper] Cua AgentCursor.swift not found at ${agentCursorPath}`);
  }

  let patchedAny = false;
  const appStateSource = fs.readFileSync(appStatePath, "utf8");
  const patchedAppState = patchCuaDriverAppStateSource(appStateSource);
  if (patchedAppState !== appStateSource) {
    fs.chmodSync(appStatePath, 0o644);
    fs.writeFileSync(appStatePath, patchedAppState);
    console.log("[computer-use-helper] patched Cua AX tree walk for bounded background snapshots");
    patchedAny = true;
  }

  const clickToolSource = fs.readFileSync(clickToolPath, "utf8");
  const patchedClickTool = patchCuaDriverClickToolSource(clickToolSource);
  if (patchedClickTool !== clickToolSource) {
    fs.chmodSync(clickToolPath, 0o644);
    fs.writeFileSync(clickToolPath, patchedClickTool);
    console.log("[computer-use-helper] patched Cua ClickTool for AXShowDefaultUI row actions");
    patchedAny = true;
  }

  const dragToolSource = fs.readFileSync(dragToolPath, "utf8");
  const patchedDragTool = patchCuaDriverDragToolSource(dragToolSource);
  if (patchedDragTool !== dragToolSource) {
    fs.chmodSync(dragToolPath, 0o644);
    fs.writeFileSync(dragToolPath, patchedDragTool);
    console.log("[computer-use-helper] patched Cua DragTool for window-bound agent cursor");
    patchedAny = true;
  }

  const getWindowStateToolSource = fs.readFileSync(getWindowStateToolPath, "utf8");
  const patchedGetWindowStateTool = patchCuaDriverGetWindowStateToolSource(getWindowStateToolSource);
  if (patchedGetWindowStateTool !== getWindowStateToolSource) {
    fs.chmodSync(getWindowStateToolPath, 0o644);
    fs.writeFileSync(getWindowStateToolPath, patchedGetWindowStateTool);
    console.log("[computer-use-helper] patched Cua get_window_state to park the cursor in observed windows");
    patchedAny = true;
  }

  const permissionsSource = fs.readFileSync(permissionsPath, "utf8");
  const patchedPermissions = patchCuaDriverPermissionsSource(permissionsSource);
  if (patchedPermissions !== permissionsSource) {
    fs.chmodSync(permissionsPath, 0o644);
    fs.writeFileSync(permissionsPath, patchedPermissions);
    console.log("[computer-use-helper] patched Cua permissions for quiet read-only status checks");
    patchedAny = true;
  }

  const checkPermissionsToolSource = fs.readFileSync(checkPermissionsToolPath, "utf8");
  const patchedCheckPermissionsTool = patchCuaDriverCheckPermissionsToolSource(checkPermissionsToolSource);
  if (patchedCheckPermissionsTool !== checkPermissionsToolSource) {
    fs.chmodSync(checkPermissionsToolPath, 0o644);
    fs.writeFileSync(checkPermissionsToolPath, patchedCheckPermissionsTool);
    console.log("[computer-use-helper] patched Cua check_permissions prompt=false preflight path");
    patchedAny = true;
  }

  const agentCursorSource = fs.readFileSync(agentCursorPath, "utf8");
  const patchedAgentCursor = patchCuaDriverAgentCursorSource(agentCursorSource);
  if (patchedAgentCursor !== agentCursorSource) {
    fs.chmodSync(agentCursorPath, 0o644);
    fs.writeFileSync(agentCursorPath, patchedAgentCursor);
    console.log("[computer-use-helper] patched Cua AgentCursor minimized target binding");
    patchedAny = true;
  }

  return patchedAny;
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function read(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

export function buildComputerUseHelper({
  rootDir = path.resolve(__dirname, ".."),
  platform = process.platform,
  env = process.env,
  arch = env.HANA_COMPUTER_USE_HELPER_ARCH || process.arch,
} = {}) {
  if (!shouldBuildComputerUseHelper({ platform })) {
    console.log(`[computer-use-helper] skipped on ${platform}`);
    return { skipped: true };
  }

  const packageDir = path.join(rootDir, "desktop", "native", "HanaComputerUseHelper");
  const swiftArch = swiftArchForNodeArch(arch);
  const scratchPath = swiftBuildScratchPath({ rootDir, arch });
  const baseArgs = [
    "--package-path",
    packageDir,
    "--scratch-path",
    scratchPath,
    "-c",
    "release",
    "--arch",
    swiftArch,
    "--product",
    "hana-computer-use-helper",
  ];

  console.log(`[computer-use-helper] building for ${swiftArch}`);
  run("swift", ["package", "resolve", "--package-path", packageDir, "--scratch-path", scratchPath], { cwd: rootDir, env });
  applyCuaDriverSourcePatches({ scratchPath });
  run("swift", ["build", ...baseArgs], { cwd: rootDir, env });

  const binPath = read("swift", ["build", "--show-bin-path", ...baseArgs], { cwd: rootDir, env });
  const source = path.join(binPath, "hana-computer-use-helper");
  if (!fs.existsSync(source)) {
    throw new Error(`[computer-use-helper] build did not produce ${source}`);
  }

  const outDir = computerUseHelperOutputDir({ rootDir, osName: "mac", arch });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "hana-computer-use-helper");
  fs.copyFileSync(source, target);
  fs.chmodSync(target, 0o755);
  const app = createComputerUseHelperAppBundle({ outputDir: outDir, sourceBinary: source });
  console.log(`[computer-use-helper] copied ${target}`);
  console.log(`[computer-use-helper] created ${app.appPath}`);
  return { skipped: false, target, app };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    buildComputerUseHelper({ arch: resolveComputerUseHelperBuildArch() });
  } catch (err) {
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  }
}
