import os from "node:os";

// 模型侧看到稳定的 bash 工具契约；Windows 的 Git/cmd/POSIX runtime
// 分派属于 win32-exec 的执行层细节，避免泄漏到 prompt 里干扰规划。
function getExecShellLabel() {
  return "bash";
}

export function getPlatformPromptNote({
  platform = process.platform,
  osType = os.type(),
  osRelease = os.release(),
  locale = "",
} = {}) {
  const isZh = String(locale || "").startsWith("zh");
  const lines = [
    `Platform: ${platform}`,
    `Shell: ${getExecShellLabel(platform)}`,
    `OS Version: ${osType} ${osRelease}`,
  ];
  if (platform === "win32") {
    if (isZh) {
      lines.push(
        "宿主系统是 Windows，但 bash 工具接受 POSIX shell 风格命令。",
        "Hanako 可能在内部把简单 git 命令交给内置 git.exe，把明确的 cmd.exe/powershell.exe 命令交给 Windows 原生命令执行器。",
        "写 shell 风格命令时，管道、路径、环境变量和重定向优先使用 POSIX 写法。",
        "只有明确需要 Windows 原生 shell 时，才使用 cmd.exe /c 或 powershell.exe -NoProfile -Command。",
        "丢弃 POSIX 命令输出用 /dev/null；只有在明确的 cmd.exe 命令里才用 CMD 的 nul 设备。",
      );
    } else {
      lines.push(
        "Host OS is Windows, but the bash tool accepts POSIX shell-style commands.",
        "Hanako may internally route simple git commands through bundled git.exe and explicit cmd.exe/powershell.exe commands through Windows-native runners.",
        "Prefer POSIX syntax for pipes, paths, environment variables, and redirection when writing shell-style commands.",
        "Use cmd.exe /c or powershell.exe -NoProfile -Command only when you explicitly need a Windows-native shell.",
        "Discard POSIX command output with /dev/null; use CMD's nul device only inside an explicit cmd.exe command.",
      );
    }
  }
  // 共享终端工具引导：让模型知道何时优先用 terminal_* 而不是 bash
  if (isZh) {
    lines.push(
      "",
      "## 器 · 终端",
      "- `terminal_*`（terminal_list / terminal_create / terminal_read / terminal_write / terminal_wait / terminal_interrupt / terminal_kill）是共享可见终端。用户能看到正在执行的命令，你也能用 terminal_interrupt 中断。",
      "- 可能需要用户观看、耗时超过几秒、会长期运行、需要交互、开发服务器、watcher、ping、build，或中途可能要打断的命令，优先用 `terminal_*`。",
      "- `bash` 只用于短、确定、一次性、需要完整捕获输出的命令，比如读文件、快速计算、一次性脚本。`bash` 会等待命令退出，异常挂起时无法由用户侧可靠中断。",
      "- 用户明确说“在终端运行”“启动”，或语义上是可观看、可取消的命令时，选择 `terminal_*`，不要改用 `bash`。",
      "- 常见链路：必要时 terminal_list → 复用已有会话或 terminal_create → terminal_write 提交命令 → terminal_wait 等输出稳定/进程退出/用户打断 → terminal_read 看结果 → 必要时 terminal_interrupt 停止。",
      "- terminal_write 之后优先用一次覆盖预期时长的 terminal_wait，不要连着很多短 wait；这样用户看到的是一张干净的输出卡片。",
      "- 一个逻辑任务最多 terminal_create 一次；后续 write / wait / interrupt / read / kill 都复用同一个 session id。只有确实需要并行 shell 或不同 cwd 时才新建。",
      "- 终端链路开始前只有在进入新阶段且确有助于理解时才给一句说明；terminal_list / terminal_create / terminal_write / terminal_wait / terminal_read 之间静默接上。工具卡片本身就是进度，不要重复播报同一个入口、URL、路径或服务地址。",
      "- 若已经说过某个入口、URL、路径、端口或服务地址，把它视为已播报对象；后续终端启动、等待、读取时不要再用“已找到/已定位/现在启动/下一步打开”等近义句复述它。说完入口后直接执行工具，最后用一次结果收束。",
      "- 如果下一句只是“我将/现在/下一步 + 同一对象”的铺垫，而不是新发现、失败、需要用户选择或最终证据，就不要发这句正文。",
      "- 用户在终端卡片上按了“打断”时，只做两件事：自然致歉并询问下一步；停止当前计划。不要重新执行刚被打断的命令，也不要向用户暴露内部字段名。",
    );
  } else {
    lines.push(
      "",
      "Shell tool selection guidance:",
      "- Default to the `terminal_*` tools (terminal_list / terminal_create / terminal_read / terminal_write / terminal_wait / terminal_interrupt / terminal_kill) for ANY command that the user might want to watch, that may take more than a few seconds, that is long-running / interactive / a dev server / a watcher / a ping / a build, or that you might need to interrupt mid-flight. The terminal_* tools share the same PTY pool as the user's visible Terminal window — the user can see exactly what is running and you can send Ctrl+C via terminal_interrupt at any time.",
      "- Use `bash` only for short, deterministic, fire-and-forget commands whose output you need fully captured (file inspection, quick computations, one-shot scripts). `bash` blocks until exit and CANNOT be interrupted; if a `bash` invocation hangs, the user has no way to recover gracefully.",
      "- When the user explicitly asks you to \"run something in the terminal\", to \"start\" a process, or implies a watchable / cancellable command, ALWAYS choose terminal_* over bash.",
      "- Typical terminal_* flow: optionally terminal_list → reuse an existing session OR terminal_create → terminal_write with the command (auto-appends Enter) → terminal_wait to block until output settles / process exits / user kills it (returns within ms when the user does anything) → terminal_read to see output → optionally terminal_interrupt to stop it.",
      "- ALWAYS prefer `terminal_wait` over the generic `wait` tool after a terminal_write. terminal_wait is event-driven and returns immediately when: new output arrives, the process exits, or the user manually closes/kills the terminal. The generic `wait` tool only sleeps for a fixed time and would leave you unaware of user-side actions until your sleep finishes — that is a bad UX.",
      "- DO NOT call terminal_create more than once per logical task. After you've created a session for a task (e.g. 'open a tab and run X then interrupt it'), reuse that same session id for ALL subsequent operations on it (write / wait / interrupt / read / kill). Every extra terminal_create produces a new shell tab the user has to manage, and it splits the per-turn output cards in the chat. Only create a NEW session when you genuinely need a parallel shell or a different cwd.",
      "- After a terminal_write that submits a command, prefer running ONE terminal_wait that covers the whole expected duration (large timeout_ms or idle_ms) over chaining many short waits. Each separate wait only captures bytes inside its own window, so chaining them fragments the chat-side preview card; a single wait gives the user one clean card containing the full command output.",
      "- Before a terminal execution chain, speak only when entering a new phase and the note adds useful context; let terminal_list / terminal_create / terminal_write / terminal_wait / terminal_read continue silently. Tool cards already show progress; do not repeat the same entrypoint, URL, path, or service address in text.",
      "- If you have already mentioned an entrypoint, URL, path, port, or service address, treat it as a reported object; do not restate it during later terminal start/wait/read steps with synonyms such as found, located, starting, or opening next. After mentioning the entrypoint, run the tool directly, then close once with the result.",
      "- If the next sentence is only 'I will / now / next + the same object' setup, and not a new finding, failure, user choice, or final evidence, do not send that prose sentence.",
      "- When the user presses the interrupt button on an embedded terminal card, terminal_wait may report reason=human_interrupt or non-empty details.humanInterruptsInWindow / details.humanInterrupts. At that point do only two things: briefly apologize and ask what they want to do next; stop the current plan. Do not rerun the interrupted command, and do not expose internal field names such as reason, human_interrupt, or terminal_wait to the user.",
    );
  }
  return lines.join("\n");
}
