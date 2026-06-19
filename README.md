<h1 align="center">HanakoPro</h1>

<p align="center">在 HanakoPro 基础上继续改造的桌面 AI Agent：道经提示词、可控记忆、目标模式、可见终端、macOS 本地运行。</p>

<p align="center">
  <a href="https://github.com/JieKiYu/HanakoPro/releases">下载 Release</a>
  ·
  <a href="https://github.com/JieKiYu/HanakoPro/issues">反馈问题</a>
  ·
  <a href="https://github.com/liliMozi/openhanako">OpenHanako</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://github.com/JieKiYu/HanakoPro"><img src="https://img.shields.io/badge/focus-Hanako%20customization-purple.svg" alt="Focus"></a>
  <a href="https://github.com/JieKiYu/HanakoPro/releases"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg" alt="Platform"></a>
</p>

---

# 项目定位

这个 README 只介绍本仓库在 HanakoPro 基础上继续做的改造，不复述原 HanakoPro 自带功能。

改造目标很明确：让 HanakoPro 更适合长期个人使用和本机工程协作。重点不是把 AI Agent 包装得更神秘，而是让它的提示词、记忆、目标、工具调用和运行过程都更可控、更可观察、更容易验证。

# 改造清单

## 道经提示词与模型行为

- 将 Hanako 的系统提示词改造成更贴近“道经 / 道 Agent”风格的分层结构。
- 保留 `agentName`、`userName`、工具、记忆、项目上下文等变量化拼装能力，同时减少模板之间互相覆盖造成的气口稀释。
- 修复 prompt commentary、`message_end`、`mood`、`pulse` 等结构化标签泄漏到聊天正文的问题。
- 修复提示词编辑页保存、展示和测试覆盖，让系统提示词修改更可控。
- 补齐 GPT-5.5 / K+ 等模型能力识别，支持 `xhigh` 等更高推理档位，不再被错误降级。

## 可控记忆系统

- 重新设计 Hanako 记忆架构，区分钉、络、镜、笺四层记忆。
- 增加动态记忆召回：只在当前任务相关时注入少量记忆，避免把整段历史长期塞进系统提示词。
- 区分“使用记忆”和“生成记忆”，让用户可以分别控制是否读取旧记忆、是否把当前会话写入未来记忆。
- 改造记忆页说明，把原本偏教程式的说明换成“记忆像镜子，不像仓库”的产品表达。
- 为记忆召回、记忆开关、会话级记忆状态补充测试。

## 目标模式

- 新增类似 Codex 的 Goal 模式，让每个会话可以有一个明确目标。
- 目标作为会话级状态持久化，支持 `active`、`complete`、`blocked` 等状态。
- 在输入区展示当前目标，不需要依赖 slash command 才能知道当前任务方向。
- 将目标注入当前会话上下文，让模型围绕目标持续推进。
- 增加目标完成后的自动验真流程，要求模型在宣布完成前进行检查。
- 修复目标结束态、底部空间、目标栏布局和目标继续执行时的多处边界问题。
- 遇到需要用户选择、确认或补充信息的场景时，目标会暂停，不再提前进入验真。

## 可见终端与本机运行

- 修复 macOS 上右上角终端按钮打不开或行为不符合本机习惯的问题。
- 支持在没有 AI 终端会话时打开本机 Ghostty。
- 优化内置终端窗口的 macOS 样式，避免 Windows 风格关闭按钮和 macOS 红黄绿窗口按钮冲突。
- 新增底部内联终端，让工具执行、命令输出和长任务运行过程能在对话界面里持续观察。
- 增强终端会话选择、终端高度、终端卡片、实时输出和中断体验。

## macOS 本地化与打包

- 新增 macOS 本地构建链路，支持在本机稳定打出 `HanakoPro.app`。
- 增加 `mac:ci`、`mac:pack:local` 等脚本，固定 Node / npm 运行环境，减少原生模块 ABI 问题。
- 增加 `HanakoPro Local Code Signing` 本地签名流程，避免每次打包都落到 ad-hoc 签名。
- 修复主题运行时代码没有打进 app 包导致设置页主题切换失败的问题。
- 增强 Computer Use helper 的构建、安装、签名和权限检测流程。
- 明确本地包和公开分发包的边界：本地自签适合个人使用，公开分发仍需要 Developer ID 和 notarization。

## 浏览器与 Computer Use 稳定性

- 移除对话消息底部多余的浏览器跳转块，同时保留侧边栏浏览器入口和浏览器工具能力。
- 修复主窗口恢复时误弹出后台浏览器窗口的问题。
- 修复不同项目 / 会话之间浏览器页面和状态串扰的问题。
- 将浏览器截图、缩略图和视觉捕获改为隐藏窗口路径，避免验证过程污染用户正在看的浏览器页面。
- 增强空截图、截图超时、缩略图轮询和浏览器状态广播的边界处理。
- 改进 macOS Computer Use daemon 冷启动、权限探测和 helper 安装判断。

## 模型、Provider 与多媒体

- 改进模型同步和 Provider 兼容，减少模型列表、推理档位、多媒体模型识别不一致的问题。
- 增加 OpenAI Responses 兼容处理和相关回放测试。
- 优化图片模型识别，让 Seedream、DALL-E、Imagen、Flux、`gpt-image-*` 等模型更自然地进入多媒体配置。
- 增加 Provider 图标、模型添加入口和多媒体页可发现性。
- 修复带图片历史会话继续对话时的 502、图片引用替换和渲染提示体验问题。

## 插件与 Codex CLI 验真

- 正在推进内置 `codex-cli` 插件，让它可以在 Hanako 插件页里配置。
- 设计并实现命令级验真任务交给 Codex CLI 执行的路径，目标是让用户能实时看到 Codex 在终端里做验证。
- Codex CLI 负责命令、构建、测试、文件和运行时检查；屏幕、窗口、点击等验收仍由 Hanako 的 Computer Use 负责。
- 这部分目前仍在本地工作区继续验证，正式合入前以代码状态为准。

## 前端体验与消息渲染

- 修复 Assistant Markdown 溢出、长表格撑破布局、表格滚动条不可见等问题。
- 优化 Markdown 表格配色、代码单元格、自动尺寸、裁剪和 tooltip。
- 改进思考块、工具块、终端卡片、文件修改卡片和输入区布局的稳定性。
- 修复撤回按钮在任务进行中、目标暂停中等状态下的显示时机。
- 优化模型选择器、输入区布局、会话列表、设置页视觉和暗色 / 主题相关细节。

## 稳定性与回归测试

- 为目标模式、会话状态、终端、浏览器、Computer Use、Provider、Prompt、记忆、消息解析和打包脚本补充测试。
- 增加针对 macOS 本地打包、签名、Computer Use helper 和主题资源的构建边界检查。
- 修复多轮迭代中发现的聊天流式输出、结构化标签、上下文压缩、图片生成、表格渲染和会话切换问题。

# 当前状态

默认维护分支是 `main`。GitHub 仓库已经脱离 fork 状态，后续功能、问题和发布节奏以 `JieKiYu/HanakoPro` 为准。

这个仓库仍保留 Hanako / OpenHanako 的代码历史和许可证；上面的清单只描述本仓库继续做过的改造。

# 从源码运行

## 环境要求

- Node.js 22 LTS 或更高版本。
- npm 10 或更高版本。
- 首次运行需要配置可用的模型服务，例如 OpenAI 兼容接口、DeepSeek、Ollama 等。

## 启动开发版

```bash
npm ci
npm run start:dev
```

如果启动时报 `better-sqlite3.node was compiled against a different Node.js version`，说明原生模块和当前 Node ABI 不匹配，可以执行：

```bash
npm rebuild better-sqlite3
```

如果终端相关能力异常，可以执行：

```bash
npm rebuild node-pty
```

# 自行打包

macOS 本地打包：

```bash
npm run mac:pack:local
```

本机开发包会优先使用 `HanakoPro Local Code Signing` 自签名。公开分发仍需要 Apple Developer ID 签名和 notarization。

Windows 打包：

```bash
npm run dist:win
```

Windows 打包配置会引用 `vendor/git-portable`。该目录体积较大，源码仓库默认不包含它；如需自行打包 Windows 安装包，需要自行准备或调整 `package.json` 中的 `build.win.extraResources` 配置。

# 与上游项目的关系

本仓库是 `JieKiYu/HanakoPro` 独立维护版本，不是官方原版 Hanako，也不再是 GitHub fork 状态。

相关项目：

```text
OpenHanako: https://github.com/liliMozi/openhanako
当前仓库: https://github.com/JieKiYu/HanakoPro
```

# 许可证

本项目沿用上游项目许可证：

```text
Apache License 2.0
```

详见 [LICENSE](LICENSE)。
