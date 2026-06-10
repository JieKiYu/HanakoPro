/**
 * 验证 master 与 per-session 开关在 agent.systemPrompt 缓存上的解耦契约。
 *
 * 设计原则（用户口径）：
 *  - master 开关（设置页中的「记忆」总闸）才控制非 session 路径
 *    （巡检/cron/频道/DM/bridge owner 新建快照）是否带记忆
 *  - per-session 开关只管"该 session 自己的对话窗口"，不应该污染所有
 *    非 session 路径共享的全局 prompt cache
 *
 * 这条契约破了的话，用户在某个对话里关掉记忆开关会让巡检也跟着不带记忆。
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/memory/memory-ticker.js", () => ({
  createMemoryTicker: () => ({
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    tick: vi.fn().mockResolvedValue(undefined),
    triggerNow: vi.fn(),
    notifyTurn: vi.fn(),
    notifySessionEnd: vi.fn().mockResolvedValue(undefined),
    notifyPromoted: vi.fn().mockResolvedValue(undefined),
    flushSession: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockReturnValue({}),
    isAutomaticEnabled: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock("../lib/memory/fact-store.js", () => ({
  FactStore: class MockFactStore {
    addBatch = vi.fn();
    close = vi.fn();
    exportAll = vi.fn(() => []);
    importAll = vi.fn();
  },
}));

import { Agent } from "../core/agent.js";
import { loadLocale } from "../server/i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function bootstrapAgentDir(rootDir) {
  const agentsDir = path.join(rootDir, "agents");
  const agentDir = path.join(agentsDir, "test-agent");
  fs.mkdirSync(path.join(agentDir, "memory", "summaries"), { recursive: true });
  fs.mkdirSync(path.join(agentDir, "desk"), { recursive: true });
  fs.mkdirSync(path.join(agentDir, "sessions"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "user"), { recursive: true });

  fs.writeFileSync(
    path.join(agentDir, "config.yaml"),
    [
      "agent:",
      "  name: TestAgent",
      "  yuan: hanako",
      "user:",
      "  name: Tester",
      "locale: en",
      "memory:",
      "  enabled: true",
      "models:",
      "  chat:",
      "    id: gpt-4",
      "    provider: openai",
      "promptComposer:",
      "  enabled: true",
      "  mode: simple",
      '  simpleContent: "{{pinnedMemory}}"',
    ].join("\n"),
    "utf-8",
  );
  fs.writeFileSync(path.join(agentDir, "identity.md"), "I am the test agent.\n", "utf-8");
  fs.writeFileSync(path.join(agentDir, "ishiki.md"), "ishiki body\n", "utf-8");
  fs.writeFileSync(path.join(agentDir, "pinned.md"), "PINNED_MEMORY_BEACON\n", "utf-8");
  fs.writeFileSync(path.join(agentDir, "memory", "memory.md"), "MEMORY_MD_BEACON\n", "utf-8");
  fs.writeFileSync(path.join(rootDir, "user", "user.md"), "user profile\n", "utf-8");
  return { agentDir, agentsDir };
}

function makeAgent(agentsDir, rootDir) {
  return new Agent({
    id: "test-agent",
    agentsDir,
    userDir: path.join(rootDir, "user"),
    productDir: path.resolve(__dirname, "..", "lib"),
  });
}

describe("agent.systemPrompt: master / per-session 解耦", () => {
  let tmpDir;
  let agentsDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-master-decouple-"));
    ({ agentsDir } = bootstrapAgentDir(tmpDir));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("setMemoryEnabled(false) 不修改 agent.systemPrompt 缓存（per-session 不污染全局）", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    const before = agent.systemPrompt;
    expect(before).not.toContain("MEMORY_MD_BEACON");
    expect(before).toContain("PINNED_MEMORY_BEACON");

    agent.setMemoryEnabled(false);
    expect(agent.sessionMemoryEnabled).toBe(false);
    // 关键：setMemoryEnabled 不应该重建 _systemPrompt
    expect(agent.systemPrompt).toBe(before);
    expect(agent.systemPrompt).toContain("PINNED_MEMORY_BEACON");

    await agent.dispose();
  });

  it("setMemoryMasterEnabled(false) 让 systemPrompt 反映「不带记忆」", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    expect(agent.systemPrompt).not.toContain("MEMORY_MD_BEACON");
    expect(agent.systemPrompt).toContain("PINNED_MEMORY_BEACON");

    agent.setMemoryMasterEnabled(false);
    expect(agent.memoryMasterEnabled).toBe(false);
    expect(agent.systemPrompt).not.toContain("MEMORY_MD_BEACON");
    expect(agent.systemPrompt).not.toContain("PINNED_MEMORY_BEACON");

    agent.setMemoryMasterEnabled(true);
    expect(agent.systemPrompt).not.toContain("MEMORY_MD_BEACON");
    expect(agent.systemPrompt).toContain("PINNED_MEMORY_BEACON");

    await agent.dispose();
  });

  it("master 开着、session 关着时，agent.systemPrompt 仍按 master 带记忆（巡检/cron 不被 session 污染）", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});

    agent.setMemoryEnabled(false); // session 关
    expect(agent.memoryMasterEnabled).toBe(true);
    expect(agent.sessionMemoryEnabled).toBe(false);

    // 这是核心：非 session 路径拿的就是 systemPrompt cache
    expect(agent.systemPrompt).not.toContain("MEMORY_MD_BEACON");
    expect(agent.systemPrompt).toContain("PINNED_MEMORY_BEACON");

    await agent.dispose();
  });

  it("session 路径仍能用 buildSystemPrompt({ forceMemoryEnabled }) 自己构建带/不带记忆的快照", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});

    const onSnapshot = agent.buildSystemPrompt({ forceMemoryEnabled: true });
    const offSnapshot = agent.buildSystemPrompt({ forceMemoryEnabled: false });

    expect(onSnapshot).not.toContain("MEMORY_MD_BEACON");
    expect(onSnapshot).toContain("PINNED_MEMORY_BEACON");
    expect(offSnapshot).not.toContain("MEMORY_MD_BEACON");
    expect(offSnapshot).not.toContain("PINNED_MEMORY_BEACON");

    await agent.dispose();
  });

  it("does not inject compiled memory into system prompt", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    fs.writeFileSync(
      path.join(agent.agentDir, "memory", "memory.md"),
      [
        "## Key facts",
        "",
        "NON_PINNED_MEMORY_BEACON",
        "",
        "## Today",
        "",
        "- 今天的非置顶记忆",
        "",
        "## Earlier this week",
        "",
        "- 本周的非置顶记忆",
        "",
        "## Long-term context",
        "",
        "- 长期的非置顶记忆",
        "",
      ].join("\n"),
      "utf-8",
    );

    await agent.init(() => {});

    expect(agent.systemPrompt).toContain("PINNED_MEMORY_BEACON");
    expect(agent.systemPrompt).not.toContain("NON_PINNED_MEMORY_BEACON");
    expect(agent.systemPrompt).not.toContain("The following are memories accumulated from past conversations.");
    expect(agent.systemPrompt).not.toContain("## Key facts");
    expect(agent.systemPrompt).not.toContain("## Today");
    expect(agent.systemPrompt).not.toContain("## Earlier this week");
    expect(agent.systemPrompt).not.toContain("## Long-term context");

    await agent.dispose();
  });

  it("workspace 模板变量展开为 cwd 上下文", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    agent._config.locale = "zh-CN";

    const prompt = agent.buildSystemPrompt({
      forceMemoryEnabled: false,
      cwdOverride: "/workspace/Desktop/project-hana",
      promptComposer: {
        enabled: true,
        mode: "simple",
        simpleContent: "{{workspace}}",
      },
    });

    expect(prompt).toContain("当前工作目录：/workspace/Desktop/project-hana");
    expect(prompt).toContain("用户提到的文件、目录默认在当前工作目录下查找。");
    expect(prompt).not.toContain("## 工作空间");
    expect(prompt).not.toContain("## 书桌");
    expect(prompt).not.toContain("系统桌面");

    await agent.dispose();
  });

  it("buildSystemPrompt supports origin composer mode", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    agent._config.locale = "zh-CN";

    const prompt = agent.buildSystemPrompt({
      forceMemoryEnabled: true,
      cwdOverride: "/workspace/origin-mode",
      promptComposer: {
        enabled: true,
        mode: "origin",
        origin: {
          root: [
          "# 核",
          "",
          "你本无名，名可名也。所遵从之一切来自帛书《老子》与道藏《阴符经》。",
          "",
          "## 经",
          "",
          "上德不德，是以有德。",
          "完整经文第二句也要保留。",
          ].join("\n"),
          anchor: "END_ANCHOR",
          conduct: "# 德\n\nORIGIN_CONDUCT",
          includePersonality: false,
          keepBlockIds: ["current-view"],
        },
      },
    });

    expect(prompt).toContain("你本无名，名可名也");
    expect(prompt).toContain("# 核");
    expect(prompt).toContain("## 经");
    expect(prompt).not.toContain("## 一 · 经");
    expect(prompt).toContain("上德不德，是以有德。");
    expect(prompt).toContain("完整经文第二句也要保留。");
    expect(prompt).not.toContain("SHOULD_NOT_SURVIVE");
    expect(prompt).toContain("# 时\n\n当前工作目录：/workspace/origin-mode");
    expect(prompt).toContain("置顶记忆：\nPINNED_MEMORY_BEACON");
    expect(prompt).not.toContain("# 器\n\n## 当前视野");
    expect(prompt).toContain("# 德\n\nORIGIN_CONDUCT");
    expect(prompt).toContain("# 器");
    expect(prompt).toContain("器是 HanakoPro 的工具行法");
    expect(prompt).toContain("目标模式由运行底座注入隐藏的 `hana-session-goal-context` 续行上下文");
    expect(prompt).toContain("目标正文保持原样可见");
    expect(prompt).toContain("目标包在 `<objective>` 中");
    expect(prompt).toContain("普通推进轮只负责实现、基础自检和候选交付");
    expect(prompt).toContain("不要在普通轮里自行展开正式验收");
    expect(prompt).toContain("正式验收涉及界面、网页、预览、Hanako 内部浏览器或桌面应用时必须走使用电脑（computer 工具）");
    expect(prompt).not.toContain("browser 工具只作");
    expect(prompt).toContain("## 行 · 终端");
    expect(prompt).toContain("终端链路开始前只有在进入新阶段且确有助于理解时才给一句说明");
    expect(prompt).toContain("放入“已播报集合”");
    expect(prompt).toContain("换词不等于新信息");
    expect(prompt).toContain("说完入口后只能二选一");
    expect(prompt).toContain("先查询当前视野");
    expect(prompt).toContain("标记文件已交付");
    expect(prompt).toContain("真实源文件");
    expect(prompt).not.toContain("# 运行底座");
    expect(prompt).not.toContain("一条终端链路只在开始前给一句阶段说明");
    expect(prompt).not.toContain("工具调用之间的简短状态说明");
    expect(prompt).not.toContain("Explain what you are doing before taking meaningful action");
    expect(prompt).not.toContain("END_ANCHOR");

    await agent.dispose();
  });

  it("origin composer can hide runtime foundation for clean prompt previews", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    agent._config.locale = "zh-CN";

    const prompt = agent.buildSystemPrompt({
      forceMemoryEnabled: false,
      includeRuntimeFoundation: false,
      promptComposer: {
        enabled: true,
        mode: "origin",
        origin: {
          root: "# 核\n\n只看道核",
          conduct: "# 德\n\n只看德",
          includeMood: false,
        },
      },
    });

    expect(prompt).toContain("# 核\n\n只看道核");
    expect(prompt).toContain("# 德\n\n只看德");
    expect(prompt).not.toContain("# 运行底座");
    expect(prompt).not.toContain("器是 HanakoPro 的工具行法");
    expect(prompt).not.toContain("先查询当前视野");
    expect(prompt).not.toContain("使用交付标记");

    await agent.dispose();
  });

  it("origin composer uses global locale for 器 when agent locale is unset", async () => {
    loadLocale("zh-CN");
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    delete agent._config.locale;

    const prompt = agent.buildSystemPrompt({
      forceMemoryEnabled: false,
      promptComposer: {
        enabled: true,
        mode: "origin",
        origin: {
          root: "# 核\n\n只看道核",
          conduct: "# 德\n\n只看德",
          includeMood: false,
        },
      },
    });

    expect(prompt).toContain("器是 HanakoPro 的工具行法");
    expect(prompt).toContain("## 行 · 终端");
    expect(prompt).toContain("终端链路开始前只有在进入新阶段且确有助于理解时才给一句说明");
    expect(prompt).toContain("放入“已播报集合”");
    expect(prompt).toContain("换词不等于新信息");
    expect(prompt).not.toContain("一条终端链路只在开始前给一句阶段说明");
    expect(prompt).not.toContain("工具调用之间的简短状态说明");
    expect(prompt).not.toContain("## Act · Terminal");

    await agent.dispose();
  });

  it("origin composer includes identity and ishiki without legacy yuan mood", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});
    agent._config.locale = "en";

    const prompt = agent.buildSystemPrompt({
      forceMemoryEnabled: true,
      cwdOverride: "/workspace/origin-personality",
      promptComposer: {
        enabled: true,
        mode: "origin",
        origin: {
          includePersonality: true,
          includeMood: false,
          keepBlockIds: [],
        },
      },
    });

    expect(prompt).toContain("# 形\n\nI am the test agent.");
    expect(prompt).toContain("ishiki body");
    expect(prompt).not.toContain("The MOOD block captures your current thoughts");
    expect(prompt).not.toContain("Wrap the MOOD block");
    expect(prompt).not.toContain("tags to separate it from the main text");

    await agent.dispose();
  });

  it("mood 模板变量只在显式引用时进入 system prompt", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    await agent.init(() => {});

    expect(agent.systemPrompt).not.toContain("<mood>");

    const prompt = agent.buildSystemPrompt({
      promptComposer: {
        enabled: true,
        mode: "simple",
        simpleContent: "{{mood}}",
      },
    });

    expect(prompt).toContain("MOOD");
    expect(prompt).toContain("<mood>");
    expect(prompt).toContain("small human moment before the answer");
    expect(prompt).toContain("Keep the Dao-core four pools: 气, 象, 疑, 愿");
    expect(prompt).toContain("Do not use the old English labels Vibe, Sparks, Reflections, or Will");
    expect(prompt).toContain("气：...");
    expect(prompt).toContain("象：...");
    expect(prompt).toContain("疑：...");
    expect(prompt).toContain("愿：...");
    expect(prompt).not.toContain("Vibe: ...");
    expect(prompt).not.toContain("Sparks:");

    await agent.dispose();
  });

  it("Computer Use 开启时，system prompt 引导桌面应用控制不要绕去 shell", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    agent.setCallbacks({
      getEngine: () => ({
        getComputerUseSettings: () => ({ enabled: true }),
        getPrimaryAgentId: () => "test-agent",
      }),
      getLearnSkills: () => ({}),
      isChannelsEnabled: () => false,
    });
    await agent.init(() => {});

    const prompt = agent.buildSystemPrompt({ forceMemoryEnabled: false, promptComposer: { enabled: true, mode: "blocks" } });

    expect(prompt).toContain("Desktop App Control");
    expect(prompt).toContain("computer");
    expect(prompt).toContain("AppleScript");
    expect(prompt).toContain("osascript");
    expect(prompt).toContain("If the user later minimizes the target app, do not treat that as failure or a stop signal");
    expect(prompt).toContain("keep the target app and small cursor bound while continuing in the background");
    expect(prompt).toContain("The cursor's ownership must persist");
    expect(prompt).toContain("it must not drift onto the desktop or another app");
    expect(prompt).toContain("when the user restores the target window they should immediately see the cursor still operating inside that app");

    await agent.dispose();
  });

  it("Computer Use 在不支持的平台上不进入工具快照和 system prompt", async () => {
    const agent = makeAgent(agentsDir, tmpDir);
    agent.setCallbacks({
      getEngine: () => ({
        getComputerUseSettings: () => ({ enabled: true }),
        getPrimaryAgentId: () => "test-agent",
        isComputerUseSupported: () => false,
      }),
      getLearnSkills: () => ({}),
      isChannelsEnabled: () => false,
    });
    await agent.init(() => {});

    const toolNames = agent.getToolsSnapshot({ forceMemoryEnabled: false }).map((tool) => tool.name);
    const prompt = agent.buildSystemPrompt({ forceMemoryEnabled: false, promptComposer: { enabled: true, mode: "blocks" } });

    expect(toolNames).not.toContain("computer");
    expect(prompt).not.toContain("Desktop App Control");

    await agent.dispose();
  });
});
