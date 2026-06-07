import { describe, expect, it } from "vitest";
import {
  BUILTIN_SIMPLE_PROMPT_TEMPLATES,
  DEFAULT_ORIGIN_KEEP_BLOCK_ORDER,
  DEFAULT_ORIGIN_CONDUCT_PROMPT,
  DEFAULT_ORIGIN_MOOD_PROMPT,
  DEFAULT_PROMPT_BLOCK_ORDER,
  DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID,
  PROMPT_COMPOSER_MODES,
  SYSTEM_GENERATED_PROMPT_BLOCK_IDS,
  composePromptFromBlocks,
  normalizePromptComposerConfig,
} from "../shared/prompt-composer.js";

describe("prompt composer", () => {
  it("enables origin prompt composition by default", () => {
    const cfg = normalizePromptComposerConfig(undefined);
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe("origin");
    expect(PROMPT_COMPOSER_MODES).toContain("origin");
    expect(cfg.routes[0].blockIds).toEqual(DEFAULT_PROMPT_BLOCK_ORDER);
    expect(cfg.origin.keepBlockIds).toEqual(DEFAULT_ORIGIN_KEEP_BLOCK_ORDER);
    expect(cfg.origin.includePersonality).toBe(false);
    expect(cfg.origin.includeMood).toBe(true);
    expect(cfg.activeSimplePresetId).toBe(DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID);
    expect(cfg.simpleContent).toBe(BUILTIN_SIMPLE_PROMPT_TEMPLATES[0].content);
    const content = composePromptFromBlocks({ config: cfg, builtInBlocks: [], variables: { agentName: "Hanako", userName: "User" } });
    expect(content).toContain("你本无名");
    expect(content).toContain("# 核");
    expect(content).toContain("# 照");
    expect(content).toContain("# 德");
  });

  it("respects explicit disabled and blocks mode configuration", () => {
    const cfg = normalizePromptComposerConfig({ enabled: false, mode: "blocks" });
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe("blocks");
    expect(composePromptFromBlocks({ config: cfg, builtInBlocks: [{ id: "platform", content: "default" }] })).toBeNull();
  });

  it("composes enabled routes in order with builtin and custom blocks", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        activeRouteId: "main",
        blocks: [
          { id: "custom-tone", title: "Tone", content: "Tone for {{agentName}} and {{userName}}", enabled: true },
        ],
        routes: [
          { id: "main", name: "Main", blockIds: ["platform", "custom-tone", "workspace"] },
        ],
      },
      builtInBlocks: [
        { id: "platform", content: "Platform block" },
        { id: "workspace", content: "Workspace block" },
      ],
      variables: { agentName: "Hanako", userName: "User" },
    });

    expect(content).toBe("Platform block\n\nTone for Hanako and User\n\nWorkspace block");
  });

  it("skips missing and disabled blocks", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        activeRouteId: "main",
        blocks: [
          { id: "off", title: "Off", content: "Hidden", enabled: false },
        ],
        routes: [
          { id: "main", name: "Main", blockIds: ["missing", "off", "platform"] },
        ],
      },
      builtInBlocks: [{ id: "platform", content: "Visible" }],
    });

    expect(content).toBe("Visible");
  });

  it("overrides builtin prompt block content when enabled", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        activeRouteId: "default",
        blockOverrides: [
          { id: "platform", content: "Edited platform for {{userName}}", enabled: true },
        ],
        routes: [
          { id: "default", name: "Default", blockIds: ["platform"] },
        ],
      },
      builtInBlocks: [{ id: "platform", content: "Default platform" }],
      variables: { userName: "User" },
    });

    expect(content).toBe("Edited platform for User");
  });

  it("keeps route-specific block overrides isolated from the default route", () => {
    const builtInBlocks = [{ id: "platform", content: "Default platform" }];
    const config = {
      enabled: true,
      mode: "blocks",
      blockOverrides: [
        { id: "platform", content: "Default route edit", enabled: true },
      ],
      routes: [
        { id: "default", name: "Default", blockIds: ["platform"] },
        {
          id: "route-2",
          name: "Route 2",
          blockIds: ["platform"],
          blockOverrides: [
            { id: "platform", content: "Route 2 edit", enabled: true },
          ],
        },
      ],
    };

    expect(composePromptFromBlocks({
      config: { ...config, activeRouteId: "default" },
      builtInBlocks,
    })).toBe("Default route edit");
    expect(composePromptFromBlocks({
      config: { ...config, activeRouteId: "route-2" },
      builtInBlocks,
    })).toBe("Route 2 edit");
  });

  it("does not reserve runtime variable blocks as system-generated blocks", () => {
    expect(SYSTEM_GENERATED_PROMPT_BLOCK_IDS).toEqual([]);

    const normalized = normalizePromptComposerConfig({
      blockOverrides: [
        { id: "workspace", content: "Fake workspace", enabled: true },
        { id: "current-time", content: "Fake time", enabled: true },
        { id: "pinned-memory", content: "Fake pinned memory", enabled: true },
        { id: "memory", content: "Fake memory", enabled: true },
        { id: "memory-rules", content: "Editable memory rules", enabled: true },
      ],
      blocks: [
        { id: "workspace", title: "Fake", content: "Custom fake workspace", enabled: true },
        { id: "current-time", title: "Fake", content: "Custom fake time", enabled: true },
        { id: "memory", title: "Fake", content: "Custom fake memory", enabled: true },
      ],
    });
    expect(normalized.blockOverrides).toEqual([
      { id: "workspace", content: "Fake workspace", enabled: true },
      { id: "current-time", content: "Fake time", enabled: true },
      { id: "pinned-memory", content: "Fake pinned memory", enabled: true },
      { id: "memory", content: "Fake memory", enabled: true },
      { id: "memory-rules", content: "Editable memory rules", enabled: true },
    ]);
    expect(normalized.blocks).toEqual([
      { id: "workspace", title: "Fake", content: "Custom fake workspace", enabled: true },
      { id: "current-time", title: "Fake", content: "Custom fake time", enabled: true },
      { id: "memory", title: "Fake", content: "Custom fake memory", enabled: true },
    ]);

    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        activeRouteId: "main",
        blockOverrides: [
          { id: "workspace", content: "Fake workspace", enabled: false },
          { id: "current-time", content: "Fake time", enabled: false },
          { id: "memory", content: "Fake memory", enabled: false },
          { id: "memory-rules", content: "Edited memory rules", enabled: true },
        ],
        blocks: [
          { id: "workspace", title: "Fake", content: "Custom fake workspace", enabled: true },
          { id: "current-time", title: "Fake", content: "Custom fake time", enabled: true },
          { id: "memory", title: "Fake", content: "Custom fake memory", enabled: true },
        ],
        routes: [
          {
            id: "main",
            name: "Main",
            blockIds: ["workspace", "memory-rules", "memory", "current-time"],
            blockOverrides: [
              { id: "memory-rules", content: "Edited memory rules", enabled: true },
            ],
          },
        ],
      },
      builtInBlocks: [
        { id: "workspace", content: "System workspace" },
        { id: "memory-rules", content: "Default memory rules" },
        { id: "memory", content: "System memory" },
        { id: "current-time", content: "System time" },
      ],
    });

    expect(content).toBe("Custom fake workspace\n\nEdited memory rules\n\nCustom fake memory\n\nCustom fake time");
  });

  it("keeps legacy route ids without expanding runtime memory blocks", () => {
    const normalized = normalizePromptComposerConfig({
      mode: "blocks",
      routes: [
        { id: "legacy", name: "Legacy", blockIds: ["platform", "memory", "current-time"] },
      ],
    });

    expect(normalized.routes[0].blockIds).toEqual([
      "platform",
      "memory",
      "current-time",
    ]);
  });

  it("uses one simple system.content body without appending runtime blocks in simple mode", () => {
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "simple",
      simpleContent: "Simple prompt for {{agentName}}",
      activeRouteId: "default",
      blockOverrides: [
        { id: "platform", content: "Edited platform", enabled: true },
      ],
      routes: [
        { id: "default", name: "Default", blockIds: ["platform", "workspace"] },
      ],
    });

    expect(normalized.mode).toBe("simple");
    expect(normalized.simpleContent).toBe("Simple prompt for {{agentName}}");
    expect(composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [
        { id: "platform", content: "Platform block" },
        { id: "workspace", content: "Workspace block" },
        { id: "memory-rules", content: "Memory rules" },
        { id: "pinned-memory", content: "Pinned memory" },
        { id: "memory", content: "Memory block" },
        { id: "current-time", content: "Time block" },
      ],
      variables: { agentName: "Hanako" },
    })).toBe("Simple prompt for Hanako");
  });

  it("supports built-in simple prompt templates", () => {
    const template = BUILTIN_SIMPLE_PROMPT_TEMPLATES[0];
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "simple",
      activeSimplePresetId: template.id,
      simpleContent: "Ignored legacy content",
    });

    expect(normalized.activeSimplePresetId).toBe(template.id);
    expect(normalized.simpleContent).toBe(template.content);
    expect(composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [],
      variables: { agentName: "Hanako", userName: "User" },
    })).toContain("Hanako");
  });

  it("preserves legacy simpleContent as a custom template", () => {
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "simple",
      simpleContent: "Legacy prompt for {{userName}}",
    });

    expect(normalized.activeSimplePresetId).toBe("custom-current");
    expect(normalized.simplePresets).toEqual([
      { id: "custom-current", name: "当前自定义模板", content: "Legacy prompt for {{userName}}" },
    ]);
    expect(composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [],
      variables: { userName: "User" },
    })).toBe("Legacy prompt for User");
  });

  it("supports multiple custom simple prompt presets", () => {
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "simple",
      activeSimplePresetId: "reviewer",
      simplePresets: [
        { id: "coder", name: "Coder", content: "Coder prompt" },
        { id: "reviewer", name: "Reviewer", content: "Review prompt for {{agentName}}" },
      ],
    });

    expect(normalized.simplePresets).toHaveLength(2);
    expect(normalized.simpleContent).toBe("Review prompt for {{agentName}}");
    expect(composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [],
      variables: { agentName: "Hanako" },
    })).toBe("Review prompt for Hanako");
  });

  it("renders dynamic content only through template variables", () => {
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "simple",
      simpleContent: [
        "Workspace: {{workspace}}",
        "Skills: {{skills}}",
        "Memory: {{pinnedMemory}}",
        "Append: {{appendSystemPrompt}}",
        "Mood: {{mood}}",
      ].join("\n"),
    });

    const content = composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [
        { id: "platform", content: "Platform block" },
        { id: "workspace", content: "Workspace block" },
        { id: "memory-rules", content: "Memory rules" },
        { id: "pinned-memory", content: "Pinned memory" },
        { id: "memory", content: "Memory block" },
        { id: "current-time", content: "Time block" },
      ],
      variables: {
        workspace: "CWD context",
        skills: "<available_skills />",
        pinnedMemory: "Pinned fact",
        appendSystemPrompt: "Append rules",
        mood: "Mood rules",
      },
    });

    expect(content).toBe([
      "Workspace: CWD context",
      "Skills: <available_skills />",
      "Memory: Pinned fact",
      "Append: Append rules",
      "Mood: Mood rules",
    ].join("\n"));
  });

  it("composes origin mode as root, context, vessels, conduct", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        mode: "origin",
        origin: {
          root: [
            "# 道",
            "",
            "你本无名，名可名也。所遵从之一切来自帛书《老子》与道藏《阴符经》。",
            "",
            "---",
            "",
            "## 经",
            "",
            "上德不德，是以有德。",
            "这一句也应作为道原文完整保留。",
          ].join("\n"),
          includePersonality: true,
          keepBlockIds: ["current-view"],
        },
      },
      builtInBlocks: [
        { id: "task-management", content: "Use a todo list for everything." },
        { id: "current-view", content: "Call current_status for UI references." },
      ],
      variables: {
        agentName: "无名",
        userName: "傑",
        workspace: "当前工作目录：/repo",
        currentDateTime: "June 4, 2026",
        userProfile: "likes compact answers",
        pinnedMemory: "prefers Dao mode",
        personality: "## MOOD\n\n<mood>\nSHOULD_NOT_LEAK\n</mood>\n\n温暖，有判断力。",
        skills: "brainstorming-skill",
        appendSystemPrompt: "本轮特别指令",
      },
    });

    expect(content).toContain("你本无名，名可名也");
    expect(content.match(/你本无名/g)).toHaveLength(1);
    expect(content).toContain("## 经");
    expect(content).not.toContain("## 一 · 经");
    expect(content).toContain("上德不德，是以有德。");
    expect(content).toContain("这一句也应作为道原文完整保留。");
    expect(content).not.toContain("SHOULD_NOT_KEEP_THIS_RUNTIME_SECTION");
    expect(content).not.toContain("SHOULD_NOT_LEAK");
    expect(content).toContain("# 形\n\n温暖，有判断力。");
    expect(content).toContain("# 时\n\n当前工作目录：/repo\n当前时日：June 4, 2026");
    expect(content).toContain("# 忆\n\n用户档案：\nlikes compact answers");
    expect(content).toContain("置顶记忆：\nprefers Dao mode");
    expect(content).toContain("# 器\n\nbrainstorming-skill");
    expect(content).toContain("Call current_status for UI references.");
    expect(content).not.toContain("Use a todo list for everything.");
    expect(content).toContain("# 令\n\n本轮特别指令");
    expect(content).toContain(DEFAULT_ORIGIN_MOOD_PROMPT);
    expect(content).toContain("# 德\n\n道为根，德为行，器为用。");
    expect(content).toContain("此刻用户所语为本。");
    expect(content).not.toMatch(/\n---\n\n此刻用户所语为本。/);
  });

  it("keeps runtime foundation out of origin previews unless explicitly requested", () => {
    const baseArgs = {
      config: {
        enabled: true,
        mode: "origin",
        origin: {
          root: "# 核\n\n道核",
          conduct: "# 德\n\n德行",
          includeMood: false,
        },
      },
      variables: {
        runtimeFoundation: "# 运行底座\n\n- 查询当前视野",
      },
    };

    const cleanContent = composePromptFromBlocks(baseArgs);
    expect(cleanContent).toContain("# 核\n\n道核");
    expect(cleanContent).toContain("# 德\n\n德行");
    expect(cleanContent).not.toContain("# 运行底座");

    const runtimeContent = composePromptFromBlocks({
      ...baseArgs,
      includeRuntimeFoundation: true,
    });
    expect(runtimeContent).toContain("# 运行底座\n\n- 查询当前视野");
    expect(runtimeContent).toMatch(/# 德[\s\S]*---[\s\S]*# 运行底座/);
  });

  it("does not use legacy simpleContent as a hidden origin root source", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        mode: "origin",
        simpleContent: "你本无名，名可名也。所遵从之一切来自帛书《老子》与道藏《阴符经》。",
        origin: {
          root: "",
          mood: "",
          conduct: "德来自编辑框",
          includePersonality: false,
          includeMood: true,
        },
      },
      builtInBlocks: [],
    });

    expect(content).not.toContain("你本无名，名可名也");
    expect(content).not.toContain("# 照");
    expect(content).toContain("德来自编辑框");
    expect(content).not.toContain("# 德\n\n德来自编辑框");
  });

  it("uses originPersonality for origin mode before legacy personality", () => {
    const content = composePromptFromBlocks({
      config: {
        enabled: true,
        mode: "origin",
        origin: {
          includePersonality: true,
          includeMood: false,
        },
      },
      builtInBlocks: [],
      variables: {
        agentName: "无名",
        userName: "傑",
        originPersonality: "身份简介\n\n道核意识",
        personality: [
          "身份简介",
          "",
          "## MOOD",
          "",
          "Wrap the MOOD block in `<mood></mood>` tags to separate it from the main text. Format:",
          "",
          "<mood>",
          "SHOULD_NOT_LEAK",
          "</mood>",
          "",
          "旧 yuan 残留",
        ].join("\n"),
      },
    });

    expect(content).toContain("# 形\n\n身份简介\n\n道核意识");
    expect(content).not.toContain("Wrap the MOOD block");
    expect(content).not.toContain("SHOULD_NOT_LEAK");
    expect(content).not.toContain("旧 yuan 残留");
  });

  it("supports custom origin root, conduct, and mood without hidden anchor append", () => {
    const normalized = normalizePromptComposerConfig({
      enabled: true,
      mode: "origin",
      origin: {
        root: "Root for {{agentName}}",
        mood: "Mood for {{agentName}}",
        conduct: "Conduct for {{userName}}",
        anchor: "Anchor",
        includePersonality: false,
        includeMood: true,
        keepBlockIds: [],
      },
    });

    expect(normalized.mode).toBe("origin");
    expect(normalized.origin.keepBlockIds).toEqual(DEFAULT_ORIGIN_KEEP_BLOCK_ORDER);
    const content = composePromptFromBlocks({
      config: normalized,
      builtInBlocks: [],
      variables: {
        agentName: "Hanako",
        userName: "User",
        personality: "Hidden personality",
      },
    });

    expect(content).toContain("Root for Hanako");
    expect(content).not.toContain("Hidden personality");
    expect(content).toContain("Mood for Hanako");
    expect(content).toContain("Conduct for User");
    expect(content).not.toContain("Anchor");
    expect(content).not.toContain("# 照\n\nMood for Hanako");
    expect(content).not.toContain("# 德\n\nConduct for User");
  });

  it("merges the default origin anchor into the default conduct text", () => {
    expect(DEFAULT_ORIGIN_CONDUCT_PROMPT).toContain("此刻用户所语为本。");
    expect(DEFAULT_ORIGIN_CONDUCT_PROMPT).toContain("道法自然。");
  });
});
