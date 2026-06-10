import { describe, expect, it } from "vitest";
import { getPlatformPromptNote } from "../core/platform-prompt.js";

const baseOpts = { osType: "TestOS", osRelease: "1.2.3" };

describe("getPlatformPromptNote", () => {
  it("emits Platform/Shell/OS Version on darwin", () => {
    const out = getPlatformPromptNote({ ...baseOpts, platform: "darwin" });
    expect(out).toContain("Platform: darwin");
    expect(out).toContain("Shell: bash");
    expect(out).toContain("OS Version: TestOS 1.2.3");
    // 非 win32 平台不应混入 Windows 专属指引
    expect(out).not.toContain("Host OS is Windows");
  });

  it("emits Platform/Shell/OS Version on linux", () => {
    const out = getPlatformPromptNote({ ...baseOpts, platform: "linux" });
    expect(out).toContain("Platform: linux");
    expect(out).toContain("Shell: bash");
    expect(out).toContain("OS Version: TestOS 1.2.3");
    expect(out).not.toContain("Host OS is Windows");
  });

  it("keeps the model-facing bash shell contract on win32", () => {
    const out = getPlatformPromptNote({ ...baseOpts, platform: "win32" });
    expect(out).toContain("Platform: win32");
    expect(out).toContain("Shell: bash");
    expect(out).toContain("OS Version: TestOS 1.2.3");
    expect(out).toContain("Host OS is Windows, but the bash tool accepts POSIX shell-style commands.");
    expect(out).toContain("Hanako may internally route simple git commands through bundled git.exe");
    expect(out).toContain("Prefer POSIX syntax for pipes, paths, environment variables, and redirection");
    expect(out).toContain("Use cmd.exe /c or powershell.exe -NoProfile -Command only when you explicitly need a Windows-native shell.");
    expect(out).toContain("Discard POSIX command output with /dev/null; use CMD's nul device only inside an explicit cmd.exe command.");
    expect(out).not.toContain("platform-adaptive");
  });

  it("emits Dao-style Chinese terminal guidance when locale is zh", () => {
    const out = getPlatformPromptNote({ ...baseOpts, platform: "darwin", locale: "zh-CN" });
    expect(out).toContain("Platform: darwin");
    expect(out).toContain("Shell: bash");
    expect(out).toContain("OS Version: TestOS 1.2.3");
    expect(out).toContain("## 器 · 终端");
    expect(out).toContain("`terminal_*`");
    expect(out).toContain("共享可见终端");
    expect(out).toContain("终端链路开始前只有在进入新阶段且确有助于理解时才给一句说明");
    expect(out).toContain("terminal_list / terminal_create / terminal_write / terminal_wait / terminal_read 之间静默接上");
    expect(out).toContain("若已经说过某个入口、URL、路径、端口或服务地址");
    expect(out).toContain("视为已播报对象");
    expect(out).toContain("“已找到/已定位/现在启动/下一步打开”等近义句复述它");
    expect(out).toContain("如果下一句只是“我将/现在/下一步 + 同一对象”的铺垫");
    expect(out).not.toContain("一条终端链路只在开始前给一句阶段说明");
    expect(out).not.toContain("Shell tool selection guidance:");
  });

  it("keeps Shell: bash on POSIX platforms regardless of $SHELL", () => {
    const out = getPlatformPromptNote({ ...baseOpts, platform: "darwin" });
    expect(out).toContain("Shell: bash");
    expect(out).not.toContain("zsh");
    expect(out).not.toContain("fish");
  });
});
