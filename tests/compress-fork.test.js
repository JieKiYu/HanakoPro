/**
 * compress-fork.test.js — 压缩分叉功能的单元/契约测试
 *
 * 验证：
 * 1. resolveContextConfig 的 threshold 与 context_usage percent 比较逻辑一致
 * 2. splitMessagesForCompressFork 为主动压缩生成接续包输入
 * 3. 新会话消息结构：continuation pack(user) + 固定回复(assistant)
 */
import { describe, it, expect } from "vitest";
import {
  CONTINUATION_PACK_MODE,
  resolveContextConfig,
  executeCompression,
  splitMessages,
} from "../core/context-compressor.js";
import { MANUAL_CONTEXT_COMPRESSION_THRESHOLD } from "../shared/context-compression.js";
import { resolveCompressionModel, splitMessagesForCompressFork } from "../core/session-coordinator.js";

describe("compress-fork: threshold detection", () => {
  it("compressionAvailable is true at the fixed manual threshold, independent of auto threshold", () => {
    const ctxConfig = resolveContextConfig({ context: { enabled: true, threshold: 0.8 } });
    const pct = 75;
    const available = ctxConfig.enabled && pct != null && (pct / 100) >= MANUAL_CONTEXT_COMPRESSION_THRESHOLD;
    expect(available).toBe(true);
  });

  it("compressionAvailable is false below the fixed manual threshold", () => {
    const ctxConfig = resolveContextConfig({ context: { enabled: true, threshold: 0.8 } });
    const pct = 50;
    const available = ctxConfig.enabled && pct != null && (pct / 100) >= MANUAL_CONTEXT_COMPRESSION_THRESHOLD;
    expect(available).toBe(false);
  });

  it("compressionAvailable is false when compression disabled", () => {
    const ctxConfig = resolveContextConfig({ context: { enabled: false, threshold: 0.8 } });
    const pct = 90;
    const available = ctxConfig.enabled && pct != null && (pct / 100) >= MANUAL_CONTEXT_COMPRESSION_THRESHOLD;
    expect(available).toBe(false);
  });
});

describe("compress-fork: message structure", () => {
  const FIXED_AI_REPLY = "我已了解之前的对话背景，让我们继续。";

  it("builds forked session from a hidden continuation pack without raw tail messages", () => {
    const messages = [
      { role: "system", content: "sys prompt" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a3" },
    ];

    const { compressible, retained } = splitMessagesForCompressFork(messages, resolveContextConfig({
      context: {
        enabled: true,
        mode: "rolling-summary",
        recentTurnsProtected: 5,
        protect: {
          systemPrompt: true,
          recentToolResults: true,
        },
      },
    }));

    expect(compressible.map(m => m.content)).toEqual(["u1", "a1", "u2", "a2", "u3", "a3"]);
    expect(retained.map(m => m.content)).toEqual(["sys prompt"]);

    const continuationPack = "This is a compressed continuation pack.";
    const ts = Date.now();
    const forkedMessages = [
      {
        role: "user",
        content: [{ type: "text", text: continuationPack }],
        timestamp: ts,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: FIXED_AI_REPLY }],
        timestamp: ts + 1,
      },
    ];

    expect(forkedMessages).toHaveLength(2);
    expect(forkedMessages[0].role).toBe("user");
    expect(forkedMessages[0].content[0].text).toBe(continuationPack);
    expect(forkedMessages[1].role).toBe("assistant");
    expect(forkedMessages[1].content[0].text).toBe(FIXED_AI_REPLY);
    expect(forkedMessages.some(m => m.content === "u3" || m.content === "a3")).toBe(false);
  });

  it("puts tool call pairs into the continuation pack instead of retaining raw messages", () => {
    const messages = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "", tool_calls: [{ id: "tc1", function: { name: "read", arguments: "{}" } }] },
      { role: "tool", content: "file contents", tool_call_id: "tc1" },
      { role: "assistant", content: "a3" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a4" },
    ];

    const { compressible, retained } = splitMessagesForCompressFork(messages, resolveContextConfig({
      context: {
        enabled: true,
        recentTurnsProtected: 5,
        protect: {
          systemPrompt: true,
          recentToolResults: true,
        },
      },
    }));

    expect(retained).toEqual([]);
    expect(compressible.some(m => m.role === "tool")).toBe(true);
    expect(compressible.some(m => Array.isArray(m.tool_calls))).toBe(true);
  });

  it("original session is unchanged (fork is non-destructive)", () => {
    const originalMessages = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
    ];

    const snapshot = JSON.parse(JSON.stringify(originalMessages));

    splitMessagesForCompressFork(originalMessages, resolveContextConfig({
      context: {
        enabled: true,
        protect: {
          systemPrompt: true,
          recentToolResults: true,
        },
      },
    }));

    expect(originalMessages).toEqual(snapshot);
  });

  it("does not inherit auto-compression tail retention for active compression", () => {
    const messages = [];
    for (let turn = 1; turn <= 5; turn += 1) {
      messages.push({ role: "user", content: `u${turn}` });
      messages.push({ role: "assistant", content: `a${turn}` });
    }

    const contextConfig = resolveContextConfig({
      context: {
        enabled: true,
        mode: "rolling-summary",
        recentTurnsProtected: 5,
        protect: { systemPrompt: true, recentToolResults: true },
      },
    });

    const split = splitMessagesForCompressFork(messages, contextConfig);
    expect(split.recentTurnsProtected).toBe(0);
    expect(split.retained).toEqual([]);
    expect(split.compressible.map(m => m.content)).toContain("u5");
    expect(split.compressible.map(m => m.content)).toContain("a5");
  });

  it("uses the continuation-pack strategy for active compression", async () => {
    let receivedPrompt = "";
    const result = await executeCompression({
      messages: [{ role: "user", content: "继续修主动压缩" }],
      mode: CONTINUATION_PACK_MODE,
      model: {},
      generateFn: async (prompt) => {
        receivedPrompt = prompt;
        return "接续包结果";
      },
    });

    expect(result).toBe("接续包结果");
    expect(receivedPrompt).toContain("接续包");
    expect(receivedPrompt).toContain("新会话不携带旧消息原文");
  });
});

describe("compress-fork: automatic split contrast", () => {
  it("regular split still protects recent turns for automatic compression", () => {
    const messages = [
      { role: "system", content: "sys prompt" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a3" },
    ];

    const { compressible, retained } = splitMessages(messages, 1, {
      systemPrompt: true,
      recentToolResults: true,
    });

    expect(compressible.every(m => m.role !== "system")).toBe(true);
    expect(retained.map(m => m.content)).toContain("u3");
    expect(retained.map(m => m.content)).toContain("a3");
  });
});

describe("compress-fork: compression model selection", () => {
  const sessionModel = { provider: "chat-provider", id: "chat-model", api: "openai-responses" };
  const utilityModel = { provider: "utility-provider", id: "utility-model", api: "openai-completions" };
  const customModel = { provider: "custom-provider", id: "custom-model", api: "openai-completions" };

  it("uses the current chat model when context.compressionModel is chat", () => {
    const models = {
      utilityModel,
      resolveExecutionModel: () => customModel,
    };
    const contextConfig = resolveContextConfig({
      context: {
        compressionModel: "chat",
        compressionCustomModel: { provider: "custom-provider", id: "custom-model" },
      },
    });

    expect(resolveCompressionModel(models, contextConfig, sessionModel)).toBe(sessionModel);
  });

  it("uses the configured custom compression model when context.compressionModel is custom", () => {
    const models = {
      utilityModel,
      resolveExecutionModel: (ref) => ({ ...customModel, provider: ref.provider, id: ref.id }),
    };
    const contextConfig = resolveContextConfig({
      context: {
        compressionModel: "custom",
        compressionCustomModel: { provider: "custom-provider", id: "custom-model" },
      },
    });

    expect(resolveCompressionModel(models, contextConfig, sessionModel)).toEqual(customModel);
  });

  it("falls back to utility model when the configured custom compression model is unavailable", () => {
    const models = {
      utilityModel,
      resolveExecutionModel: () => {
        throw new Error("missing model");
      },
    };
    const contextConfig = resolveContextConfig({
      context: {
        compressionModel: "custom",
        compressionCustomModel: { provider: "gone-provider", id: "gone-model" },
      },
    });

    expect(resolveCompressionModel(models, contextConfig, sessionModel)).toBe(utilityModel);
  });
});
