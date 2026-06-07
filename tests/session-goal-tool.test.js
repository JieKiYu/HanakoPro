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
    const engine = {
      getSessionGoal: vi.fn(() => goal),
      markSessionGoalComplete: vi.fn((_sessionPath, note) => ({
        ok: true,
        goal: { ...goal, status: "complete", note },
      })),
    };
    const tool = createSessionGoalTool({ getEngine: () => engine });

    const result = await tool.execute("call-1", { action: "complete", note: "verified" }, null, null, makeCtx());

    expect(engine.markSessionGoalComplete).toHaveBeenCalledWith("/tmp/session.jsonl", "verified");
    expect(textOf(result)).toContain("finish goal mode");
    expect(result.details.goal.status).toBe("complete");
  });

  it("marks the active session goal blocked", async () => {
    const goal = { objective: "finish goal mode", status: "active" };
    const engine = {
      getSessionGoal: vi.fn(() => goal),
      markSessionGoalBlocked: vi.fn((_sessionPath, note) => ({
        ok: true,
        goal: { ...goal, status: "blocked", note },
      })),
    };
    const tool = createSessionGoalTool({ getEngine: () => engine });

    const result = await tool.execute("call-2", { action: "blocked", note: "missing input" }, null, null, makeCtx());

    expect(engine.markSessionGoalBlocked).toHaveBeenCalledWith("/tmp/session.jsonl", "missing input");
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
