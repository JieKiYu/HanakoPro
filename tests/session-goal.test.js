import { describe, expect, it } from "vitest";
import {
  buildSessionGoalText,
  injectSessionGoalMessages,
  makeSessionGoal,
  normalizeSessionGoal,
} from "../core/session-coordinator.js";

describe("session goal", () => {
  it("normalizes string and object goals", () => {
    expect(normalizeSessionGoal("  ship goal mode  ")).toMatchObject({
      objective: "ship goal mode",
      status: "active",
    });
    expect(normalizeSessionGoal({ objective: "done", status: "complete", updatedAt: "2026-06-06T00:00:00.000Z" })).toMatchObject({
      objective: "done",
      status: "complete",
      completedAt: "2026-06-06T00:00:00.000Z",
    });
    expect(normalizeSessionGoal({ objective: "wait", status: "paused", updatedAt: "2026-06-06T00:00:00.000Z" })).toMatchObject({
      objective: "wait",
      status: "paused",
      pausedAt: "2026-06-06T00:00:00.000Z",
    });
    expect(normalizeSessionGoal({ objective: "   " })).toBeNull();
  });

  it("tracks goal runtime across active spans without counting paused time", () => {
    const paused = makeSessionGoal("ship runtime", {
      previousGoal: {
        objective: "ship runtime",
        status: "active",
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z",
        activeStartedAt: "2026-06-06T00:00:00.000Z",
        elapsedMs: 5000,
      },
      status: "paused",
    });

    expect(paused.status).toBe("paused");
    expect(paused.elapsedMs).toBeGreaterThanOrEqual(5000);
    expect(paused.activeStartedAt).toBeUndefined();

    const resumed = makeSessionGoal("ship runtime", {
      previousGoal: paused,
      status: "active",
    });
    expect(resumed.status).toBe("active");
    expect(resumed.elapsedMs).toBe(paused.elapsedMs);
    expect(resumed.activeStartedAt).toBe(resumed.updatedAt);
  });

  it("only builds context for active goals", () => {
    const active = makeSessionGoal("Keep the session focused");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("Current Session Goal");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("user-perspective acceptance");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("用户视角验收");
    expect(buildSessionGoalText({ ...active, status: "paused" }, { locale: "en" })).toBe("");
    expect(buildSessionGoalText({ ...active, status: "complete" }, { locale: "en" })).toBe("");
  });

  it("injects the goal before the latest user message", () => {
    const messages = [
      { role: "user", content: "old" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "latest" },
    ];
    const result = injectSessionGoalMessages(messages, makeSessionGoal("finish the feature"), { locale: "en" });
    expect(result.injected).toBe(1);
    expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant", "custom", "user"]);
    expect(result.messages[2].customType).toBe("hana-session-goal-context");
    expect(result.messages[2].content).toContain("finish the feature");
  });
});
