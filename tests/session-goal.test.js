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
    expect(normalizeSessionGoal({ objective: "   " })).toBeNull();
  });

  it("only builds context for active goals", () => {
    const active = makeSessionGoal("Keep the session focused");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("Current Session Goal");
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
