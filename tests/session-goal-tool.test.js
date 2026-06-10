import { describe, expect, it, vi } from "vitest";
import { createSessionGoalTool } from "../lib/tools/session-goal-tool.js";
import { classifySessionPermission } from "../core/session-permission-mode.js";

function textOf(result) {
  return result?.content?.[0]?.text || "";
}

function makeCtx(sessionPath = "/tmp/session.jsonl") {
  return {
    sessionManager: {
      getSessionFile: () => sessionPath,
    },
  };
}

describe("session_goal tool", () => {
  it("marks the active session goal complete", async () => {
    const goal = { objective: "finish goal mode", status: "active" };
    const computerHost = { stop: vi.fn(async () => true) };
    const engine = {
      getSessionGoal: vi.fn(() => goal),
      markSessionGoalComplete: vi.fn((_sessionPath, note) => ({
        ok: true,
        goal: { ...goal, status: "complete", note, elapsedMs: 65_000, metrics: { tokenUsage: 3210, elapsedMs: 65_000 } },
      })),
    };
    const tool = createSessionGoalTool({ getEngine: () => engine, getComputerHost: () => computerHost, getAgentId: () => "hana" });

    const result = await tool.execute("call-1", { action: "complete", note: "verified" }, null, null, {
      ...makeCtx(),
      agentId: "hana",
      model: { id: "gpt-5.5" },
    });

    expect(engine.markSessionGoalComplete).toHaveBeenCalledWith("/tmp/session.jsonl", "verified");
    expect(computerHost.stop).toHaveBeenCalledWith({
      sessionPath: "/tmp/session.jsonl",
      agentId: "hana",
      model: { id: "gpt-5.5" },
    });
    expect(textOf(result)).toContain("验真已合");
    expect(textOf(result)).toContain("verified");
    expect(textOf(result)).toContain("目标用量：3210 tokens，用时约 1分 5 秒。");
    expect(result.details.goal.status).toBe("complete");
    expect(result.details.metrics).toMatchObject({ tokenUsage: 3210, elapsedMs: 65_000 });
    expect(result.details.summary).toContain("目标用量：3210 tokens，用时约 1分 5 秒。");
    expect(result.details.computerCleanup).toBe(true);
  });

  it("marks the active session goal blocked", async () => {
    const goal = { objective: "finish goal mode", status: "active" };
    const computerHost = { stop: vi.fn(async () => false) };
    const engine = {
      getSessionGoal: vi.fn(() => goal),
      markSessionGoalBlocked: vi.fn((_sessionPath, note) => ({
        ok: true,
        goal: { ...goal, status: "blocked", note },
      })),
    };
    const tool = createSessionGoalTool({ getEngine: () => engine, getComputerHost: () => computerHost });

    const result = await tool.execute("call-2", { action: "blocked", note: "missing input" }, null, null, makeCtx());

    expect(engine.markSessionGoalBlocked).toHaveBeenCalledWith("/tmp/session.jsonl", "missing input");
    expect(computerHost.stop).toHaveBeenCalledWith({
      sessionPath: "/tmp/session.jsonl",
      agentId: null,
      model: null,
    });
    expect(textOf(result)).toContain("finish goal mode");
    expect(result.details.goal.status).toBe("blocked");
  });

  it("requires an active current goal", async () => {
    const tool = createSessionGoalTool({
      getEngine: () => ({ getSessionGoal: () => null }),
    });

    const result = await tool.execute("call-3", { action: "complete" }, null, null, makeCtx());

    expect(textOf(result)).toBeTruthy();
    expect(result.details.sessionPath).toBe("/tmp/session.jsonl");
  });

  it("is allowed in read-only permission mode", () => {
    expect(classifySessionPermission({ mode: "read_only", toolName: "session_goal" }))
      .toEqual({ action: "allow" });
  });
});
