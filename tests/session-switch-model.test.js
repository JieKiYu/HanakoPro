import { describe, expect, it, vi } from "vitest";

const { estimateTokensMock } = vi.hoisted(() => ({
  estimateTokensMock: vi.fn(() => 2000),
}));

vi.mock("../lib/pi-sdk/index.js", () => ({
  createAgentSession: vi.fn(),
  SessionManager: {
    create: vi.fn(),
    open: vi.fn(),
  },
  estimateTokens: estimateTokensMock,
  findCutPoint: vi.fn(),
  generateSummary: vi.fn(),
  emitSessionShutdown: vi.fn(),
  refreshSessionModelFromRegistry: vi.fn(),
}));

vi.mock("../lib/debug-log.js", () => ({
  createModuleLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { SessionCoordinator } from "../core/session-coordinator.js";

describe("SessionCoordinator.switchSessionModel", () => {
  it("reports per-session model switch state through a public query", () => {
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => null,
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "medium" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
    });

    coord.sessions.set("/tmp/session.jsonl", {
      session: {},
      _switching: true,
    });

    expect(coord.isSessionSwitching("/tmp/session.jsonl")).toBe(true);
    expect(coord.isSessionSwitching("/tmp/missing.jsonl")).toBe(false);
  });

  it("rejects model switch instead of auto-adapting when context exceeds the target window", async () => {
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => null,
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "medium" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
    });

    const setModel = vi.fn(async () => {});
    const entry = {
      session: {
        model: { id: "old-model", provider: "test", contextWindow: 64000 },
        isCompacting: false,
        getContextUsage: () => ({ tokens: 10000 }),
        agent: {
          state: {
            messages: [
              { role: "system", content: "sys" },
              { role: "user", content: "question" },
              { role: "assistant", content: "answer" },
            ],
          },
        },
        setModel,
      },
      modelId: "old-model",
      modelProvider: "test",
    };
    coord.sessions.set("/tmp/session.jsonl", entry);

    const compactSpy = vi.spyOn(coord, "_compactWithModel").mockResolvedValue();
    const truncateSpy = vi.spyOn(coord, "_hardTruncate").mockResolvedValue();

    await expect(coord.switchSessionModel("/tmp/session.jsonl", {
      id: "new-model",
      provider: "test",
      contextWindow: 12000,
    })).rejects.toThrow("请先压缩对话再切换模型");

    expect(compactSpy).not.toHaveBeenCalled();
    expect(truncateSpy).not.toHaveBeenCalled();
    expect(setModel).not.toHaveBeenCalled();
    expect(entry.modelId).toBe("old-model");
    expect(entry.modelProvider).toBe("test");
  });

  it("falls back from xhigh to high when switching to a model without max thinking support", async () => {
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => null,
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "xhigh" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
    });
    vi.spyOn(coord, "writeSessionMeta").mockResolvedValue();

    const setModel = vi.fn(async () => {});
    const setThinkingLevel = vi.fn();
    const entry = {
      session: {
        model: { id: "max-model", provider: "test", contextWindow: 64000, xhigh: true },
        isCompacting: false,
        getContextUsage: () => ({ tokens: 1000 }),
        agent: { state: { messages: [] } },
        setModel,
        setThinkingLevel,
      },
      modelId: "max-model",
      modelProvider: "test",
      thinkingLevel: "xhigh",
    };
    coord.sessions.set("/tmp/session.jsonl", entry);

    const result = await coord.switchSessionModel("/tmp/session.jsonl", {
      id: "regular-model",
      provider: "test",
      contextWindow: 64000,
    });

    expect(result).toEqual({ adaptations: [], thinkingLevel: "high" });
    expect(setModel).toHaveBeenCalledOnce();
    expect(setThinkingLevel).toHaveBeenCalledWith("high");
    expect(entry.thinkingLevel).toBe("high");
    expect(coord.writeSessionMeta).toHaveBeenCalledWith("/tmp/session.jsonl", expect.objectContaining({
      thinkingLevel: "high",
    }));
  });

  it("repairs old assistant metadata from model_change history before prompting after a switch", async () => {
    const oldModel = {
      id: "old-model",
      provider: "old-provider",
      api: "old-api",
      contextWindow: 64000,
      input: ["text"],
    };
    const newModel = {
      id: "new-model",
      provider: "new-provider",
      api: "new-api",
      contextWindow: 64000,
      input: ["text"],
    };
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => ({
        resolveExecutionModel: ({ id, provider }) => {
          if (id === oldModel.id && provider === oldModel.provider) return oldModel;
          if (id === newModel.id && provider === newModel.provider) return newModel;
          return null;
        },
      }),
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "medium" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
      getEngine: () => null,
    });

    const oldAssistant = {
      role: "assistant",
      content: [{ type: "text", text: "old answer" }],
      stopReason: "stop",
    };
    const prompt = vi.fn(async () => {});
    coord.sessions.set("/tmp/session.jsonl", {
      session: {
        model: newModel,
        sessionManager: {
          getBranch: () => [
            { type: "model_change", provider: oldModel.provider, modelId: oldModel.id },
            { type: "message", message: { role: "user", content: [{ type: "text", text: "old question" }] } },
            { type: "message", message: oldAssistant },
            { type: "model_change", provider: newModel.provider, modelId: newModel.id },
          ],
        },
        messages: [oldAssistant],
        prompt,
      },
      agentId: "hana",
      modelId: newModel.id,
      modelProvider: newModel.provider,
    });

    await coord.promptSession("/tmp/session.jsonl", "continue");

    expect(prompt).toHaveBeenCalledWith("continue", undefined);
    expect(oldAssistant).toMatchObject({
      api: oldModel.api,
      provider: oldModel.provider,
      model: oldModel.id,
    });
    expect(oldAssistant).not.toMatchObject({
      api: newModel.api,
      provider: newModel.provider,
      model: newModel.id,
    });
  });

  it("compacts incompatible tool-call history when switching across provider protocols", async () => {
    const oldModel = {
      id: "mimo-v2.5-pro",
      provider: "mimo-token-plan",
      api: "openai-completions",
      contextWindow: 64000,
      input: ["text"],
    };
    const newModel = {
      id: "gpt-5.5",
      provider: "acui",
      api: "openai-responses",
      contextWindow: 64000,
      input: ["text"],
      reasoning: true,
    };
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => ({ resolveThinkingLevel: (level) => level }),
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "high" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
    });
    vi.spyOn(coord, "writeSessionMeta").mockResolvedValue();

    const oldUser = { role: "user", content: [{ type: "text", text: "continue the work" }], timestamp: 1 };
    const oldAssistant = {
      role: "assistant",
      api: oldModel.api,
      provider: oldModel.provider,
      model: oldModel.id,
      content: [
        { type: "thinking", thinking: "private reasoning from old provider", thinkingSignature: "reasoning_content" },
        { type: "toolCall", id: "call_1", name: "bash", arguments: { cmd: "npm test" } },
      ],
      stopReason: "toolUse",
      timestamp: 2,
    };
    const oldToolResult = {
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "bash",
      content: [{ type: "text", text: "tests passed" }],
      timestamp: 3,
    };
    const branch = [
      { type: "model_change", id: "old-model-change", parentId: null, provider: oldModel.provider, modelId: oldModel.id },
      { type: "message", id: "old-user", parentId: "old-model-change", message: oldUser },
      { type: "message", id: "old-assistant", parentId: "old-user", message: oldAssistant },
      { type: "message", id: "old-tool-result", parentId: "old-assistant", message: oldToolResult },
    ];
    const sessionManager = {
      getBranch: () => branch,
      appendModelChange: vi.fn((provider, modelId) => {
        branch.push({ type: "model_change", id: "new-model-change", parentId: branch.at(-1)?.id || null, provider, modelId });
        return "new-model-change";
      }),
      appendCompaction: vi.fn((summary, firstKeptEntryId, tokensBefore, details) => {
        branch.push({
          type: "compaction",
          id: "switch-compaction",
          parentId: branch.at(-1)?.id || null,
          summary,
          firstKeptEntryId,
          tokensBefore,
          details,
        });
        return "switch-compaction";
      }),
      buildSessionContext: vi.fn(() => ({
        messages: [{
          role: "compactionSummary",
          summary: branch.at(-1).summary,
          tokensBefore: branch.at(-1).tokensBefore,
          timestamp: Date.now(),
        }],
      })),
    };
    const setThinkingLevel = vi.fn();
    const session = {
      model: oldModel,
      isCompacting: false,
      getContextUsage: () => ({ tokens: 1000 }),
      agent: { state: { messages: [oldUser, oldAssistant, oldToolResult] } },
      sessionManager,
      setModel: vi.fn(async (model) => {
        session.model = model;
        session.agent.state.model = model;
        sessionManager.appendModelChange(model.provider, model.id);
      }),
      setThinkingLevel,
    };
    coord.sessions.set("/tmp/session.jsonl", {
      session,
      modelId: oldModel.id,
      modelProvider: oldModel.provider,
      thinkingLevel: "high",
    });

    const result = await coord.switchSessionModel("/tmp/session.jsonl", newModel);

    expect(result.adaptations).toContain("protocol-boundary-compaction");
    expect(sessionManager.appendCompaction).toHaveBeenCalledWith(
      expect.stringContaining("模型切换前的对话压缩摘要"),
      "new-model-change",
      expect.any(Number),
      expect.objectContaining({
        reason: "model-switch-protocol-boundary",
        oldProvider: oldModel.provider,
        newProvider: newModel.provider,
      }),
    );
    expect(session.agent.state.messages).toHaveLength(1);
    expect(session.agent.state.messages[0]).toMatchObject({ role: "compactionSummary" });
    expect(session.agent.state.messages.some((message) => message.role === "toolResult")).toBe(false);
    expect(session.agent.state.messages.some((message) => (
      message.role === "assistant"
      && Array.isArray(message.content)
      && message.content.some((block) => block.type === "toolCall")
    ))).toBe(false);
  });

  it("compacts an already-switched incompatible history before the next prompt", async () => {
    const oldModel = {
      id: "mimo-v2.5-pro",
      provider: "mimo-token-plan",
      api: "openai-completions",
      contextWindow: 64000,
      input: ["text"],
    };
    const newModel = {
      id: "gpt-5.5",
      provider: "acui",
      api: "openai-responses",
      contextWindow: 64000,
      input: ["text"],
      reasoning: true,
    };
    const coord = new SessionCoordinator({
      agentsDir: "/tmp/agents",
      getAgent: () => ({ sessionDir: "/tmp/sessions" }),
      getActiveAgentId: () => "hana",
      getModels: () => ({
        resolveExecutionModel: ({ id, provider }) => {
          if (id === oldModel.id && provider === oldModel.provider) return oldModel;
          if (id === newModel.id && provider === newModel.provider) return newModel;
          return null;
        },
      }),
      getResourceLoader: () => null,
      getSkills: () => null,
      buildTools: () => ({ tools: [], customTools: [] }),
      emitEvent: () => {},
      getHomeCwd: () => "/tmp",
      agentIdFromSessionPath: () => null,
      switchAgentOnly: async () => {},
      getConfig: () => ({}),
      getPrefs: () => ({ getThinkingLevel: () => "high" }),
      getAgents: () => new Map(),
      getActivityStore: () => null,
      getAgentById: () => null,
      listAgents: () => [],
      getEngine: () => null,
    });

    const oldUser = { role: "user", content: [{ type: "text", text: "old task" }], timestamp: 1 };
    const oldAssistant = {
      role: "assistant",
      api: oldModel.api,
      provider: oldModel.provider,
      model: oldModel.id,
      content: [{ type: "toolCall", id: "call_1", name: "bash", arguments: { cmd: "npm test" } }],
      stopReason: "toolUse",
      timestamp: 2,
    };
    const oldToolResult = {
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "bash",
      content: [{ type: "text", text: "tests passed" }],
      timestamp: 3,
    };
    const failedNewAssistant = {
      role: "assistant",
      api: newModel.api,
      provider: newModel.provider,
      model: newModel.id,
      content: [],
      stopReason: "error",
      errorMessage: "403 Your request was blocked.",
      timestamp: 5,
    };
    const branch = [
      { type: "model_change", id: "old-model-change", parentId: null, provider: oldModel.provider, modelId: oldModel.id },
      { type: "message", id: "old-user", parentId: "old-model-change", message: oldUser },
      { type: "message", id: "old-assistant", parentId: "old-user", message: oldAssistant },
      { type: "message", id: "old-tool-result", parentId: "old-assistant", message: oldToolResult },
      { type: "model_change", id: "new-model-change", parentId: "old-tool-result", provider: newModel.provider, modelId: newModel.id },
      { type: "message", id: "retry-user", parentId: "new-model-change", message: { role: "user", content: [{ type: "text", text: "continue" }] } },
      { type: "message", id: "failed-new-assistant", parentId: "retry-user", message: failedNewAssistant },
    ];
    const sessionManager = {
      getBranch: () => branch,
      appendCompaction: vi.fn((summary, firstKeptEntryId, tokensBefore, details) => {
        branch.push({
          type: "compaction",
          id: "switch-compaction",
          parentId: branch.at(-1)?.id || null,
          summary,
          firstKeptEntryId,
          tokensBefore,
          details,
        });
        return "switch-compaction";
      }),
      buildSessionContext: vi.fn(() => ({
        messages: [{
          role: "compactionSummary",
          summary: branch.at(-1).summary,
          tokensBefore: branch.at(-1).tokensBefore,
          timestamp: Date.now(),
        }],
      })),
    };
    const prompt = vi.fn(async () => {});
    const session = {
      model: newModel,
      sessionManager,
      agent: { state: { messages: [oldUser, oldAssistant, oldToolResult, failedNewAssistant] } },
      prompt,
    };
    coord.sessions.set("/tmp/session.jsonl", {
      session,
      agentId: "hana",
      modelId: newModel.id,
      modelProvider: newModel.provider,
    });

    await coord.promptSession("/tmp/session.jsonl", "继续完成");

    expect(sessionManager.appendCompaction).toHaveBeenCalledWith(
      expect.stringContaining("模型切换前的对话压缩摘要"),
      "new-model-change",
      expect.any(Number),
      expect.objectContaining({ reason: "model-switch-protocol-boundary" }),
    );
    expect(prompt).toHaveBeenCalledWith("继续完成", undefined);
    expect(session.agent.state.messages).toHaveLength(1);
    expect(session.agent.state.messages.some((message) => message.role === "toolResult")).toBe(false);
  });
});
