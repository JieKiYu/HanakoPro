import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildMemoryRecallContext,
  buildMemoryRecallText,
  injectMemoryRecallMessages,
  resolveMemoryBehavior,
} from "../lib/memory/recall.js";

function makeAgent(agentDir, config = {}) {
  return {
    agentDir,
    config: {
      locale: "zh",
      memory: { enabled: true },
      ...config,
    },
    summaryManager: {
      getAllSummaries: () => [],
    },
  };
}

describe("memory recall", () => {
  let tmpDir;
  let agentDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hana-memory-recall-"));
    agentDir = path.join(tmpDir, "agents", "hana");
    fs.mkdirSync(path.join(agentDir, "memory"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recalls pinned memory by lexical overlap", () => {
    fs.writeFileSync(
      path.join(agentDir, "pinned.md"),
      "- 用户喜欢 mimo 的回复保持温柔、直接、少助手腔\n",
      "utf-8",
    );

    const result = buildMemoryRecallContext({
      agent: makeAgent(agentDir),
      messages: [{ role: "user", content: "mimo 的回复风格继续怎么调？" }],
      cwd: tmpDir,
    });

    expect(result.items[0]).toMatchObject({ source: "pinned" });
    expect(result.text).toContain("Hanako Recalled Memory");
    expect(result.text).toContain("用户最新请求、当前文件、工具结果和明确指令高于记忆");
    expect(result.text).toContain("mimo");
  });

  it("skips recall when memory is disabled or use is off", () => {
    fs.writeFileSync(path.join(agentDir, "pinned.md"), "- Hanako 要记住这条\n", "utf-8");

    expect(buildMemoryRecallContext({
      agent: makeAgent(agentDir, { memory: { enabled: false } }),
      messages: [{ role: "user", content: "Hanako 还记得吗？" }],
    })).toEqual({ text: "", items: [] });

    expect(buildMemoryRecallContext({
      agent: makeAgent(agentDir, { memory: { enabled: true, use: false } }),
      messages: [{ role: "user", content: "Hanako 还记得吗？" }],
    })).toEqual({ text: "", items: [] });
  });

  it("recalls prior summaries on reference-triggered turns and excludes the current session", () => {
    const sessionPath = path.join(agentDir, "sessions", "current-session.jsonl");
    const agent = makeAgent(agentDir);
    agent.summaryManager.getAllSummaries = () => [
      {
        session_id: "current-session",
        summary: "当前会话摘要不应该被召回",
        updated_at: "2026-06-04T01:00:00.000Z",
      },
      {
        session_id: "older-session",
        summary: "上次讨论了 Hanako 记忆改造的钉络镜笺四层结构",
        updated_at: "2026-06-03T01:00:00.000Z",
      },
    ];

    const result = buildMemoryRecallContext({
      agent,
      messages: [{ role: "user", content: "继续之前 Hanako 记忆改造的设计" }],
      sessionPath,
    });

    expect(result.items.some((item) => item.text.includes("当前会话摘要"))).toBe(false);
    expect(result.items.some((item) => item.source === "summary" && item.id === "older-session")).toBe(true);
    expect(result.text).toContain("钉络镜笺");
  });

  it("recalls prior summaries without the user saying previous or continue", () => {
    const agent = makeAgent(agentDir);
    agent.summaryManager.getAllSummaries = () => [
      {
        session_id: "dao-memory-design",
        summary: "Hanako 记忆改造采用钉络镜笺四层结构，重点是自然召回而不是整包注入",
        updated_at: "2026-06-03T01:00:00.000Z",
      },
    ];

    const result = buildMemoryRecallContext({
      agent,
      messages: [{ role: "user", content: "Hanako 记忆改造怎么推进更自然？" }],
    });

    expect(result.items.some((item) => item.source === "summary")).toBe(true);
    expect(result.text).toContain("自然召回");
  });

  it("recalls compiled memory and diary entries through the same path", () => {
    fs.writeFileSync(
      path.join(agentDir, "memory", "facts.md"),
      "- 用户希望交付前帮他打包、签名并重启 Hanako，而不是让他手动重开\n",
      "utf-8",
    );
    fs.writeFileSync(
      path.join(agentDir, "memory", "longterm.md"),
      "用户长期关注道核助手、mood 气口和 agent 的温度。\n",
      "utf-8",
    );
    const diaryDir = path.join(tmpDir, "diary");
    fs.mkdirSync(diaryDir, { recursive: true });
    fs.writeFileSync(
      path.join(diaryDir, "2026-06-04.md"),
      "# 道核 mood\n今天记录：mood 里的气、象、疑、愿要像人，不要工程化。\n",
      "utf-8",
    );

    const result = buildMemoryRecallContext({
      agent: makeAgent(agentDir),
      messages: [{ role: "user", content: "道核 mood 的口气怎么保持像人？Hanako 交付时要注意什么？" }],
      cwd: tmpDir,
      maxItems: 6,
    });

    expect(result.items.some((item) => item.source === "facts")).toBe(true);
    expect(result.items.some((item) => item.source === "longterm")).toBe(true);
    expect(result.items.some((item) => item.source === "diary")).toBe(true);
    expect(result.text).toContain("打包、签名并重启");
    expect(result.text).toContain("mood");
  });

  it("formats hidden recall text with concise source labels", () => {
    const text = buildMemoryRecallText([
      { source: "facts", label: "镜:事实", text: "用户偏好先做完再交付", updatedAt: "2026-06-04T00:00:00.000Z" },
    ]);

    expect(text).toContain("- [镜:事实] 用户偏好先做完再交付 (2026-06-04)");
    expect(text).toContain("若记忆无关或与事实冲突，忽略它");
  });

  it("injects hidden recall before the latest user message", () => {
    const messages = [
      { role: "system", content: "root" },
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "latest" },
    ];

    const result = injectMemoryRecallMessages(messages, "memory ctx");

    expect(result.injected).toBe(1);
    expect(result.messages.map((msg) => msg.role)).toEqual(["system", "user", "assistant", "system", "user"]);
    expect(result.messages[3].content[0].text).toBe("memory ctx");
  });

  it("resolves use and generate from the memory master switch", () => {
    expect(resolveMemoryBehavior({ memory: { enabled: true } })).toEqual({
      enabled: true,
      use: true,
      generate: true,
    });
    expect(resolveMemoryBehavior({ memory: { enabled: true, use: false, generate: false } })).toEqual({
      enabled: true,
      use: false,
      generate: false,
    });
    expect(resolveMemoryBehavior({ memory: { enabled: false, use: true, generate: true } })).toEqual({
      enabled: false,
      use: false,
      generate: false,
    });
  });
});
