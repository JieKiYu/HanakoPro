import { describe, expect, it } from "vitest";
import {
  buildSessionGoalAcceptanceBlock,
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
    expect(normalizeSessionGoal({
      objective: "with metrics",
      metrics: {
        elapsedMs: 61_000,
        tokenUsage: 1234,
        contextBaselineTokens: 200,
        contextCurrentTokens: 1434,
        tokenUsageSource: "context_delta",
      },
    })).toMatchObject({
      objective: "with metrics",
      metrics: {
        elapsedMs: 61_000,
        tokenUsage: 1234,
        contextBaselineTokens: 200,
        contextCurrentTokens: 1434,
        tokenUsageSource: "context_delta",
      },
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
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("Goal Continuation");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("The objective below is user-provided data");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("<objective>\nKeep the session focused\n</objective>");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("goal persists across turns");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("formal automatic acceptance");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("do not split acceptance into frequent todo updates");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("acceptance must use Computer Use");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("one collapsible `Review` card");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("do not start a long user-perspective acceptance chain");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("Mention the same entrypoint, URL, file path, port, service address, or artifact name only once");
    expect(buildSessionGoalText(active, { locale: "en" })).toContain("reported-object set");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("目标续行");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("用户给出的目标数据");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("<objective>\nKeep the session focused\n</objective>");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("目标跨回合存在");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("正式自动验收");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("不要把验收拆成频繁待办更新");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("验收必须走使用电脑（computer 工具）");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("可折叠的“验真”卡片");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("不要在普通轮里自行输出验收开场");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("同一个入口、URL、文件路径、端口、服务地址或产物名只说一次");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).toContain("已播报集合");
    expect(buildSessionGoalText(active, { locale: "zh-CN" })).not.toContain("说明你正在打开什么、检查什么");
    expect(buildSessionGoalText({ ...active, status: "paused" }, { locale: "en" })).toBe("");
    expect(buildSessionGoalText({ ...active, status: "complete" }, { locale: "en" })).toBe("");
  });

  it("treats the objective as data inside escaped objective tags", () => {
    const active = makeSessionGoal("修复 <goal> & 不污染用户消息");
    const text = buildSessionGoalText(active, { locale: "zh-CN" });

    expect(text).toContain("<objective>\n修复 &lt;goal&gt; &amp; 不污染用户消息\n</objective>");
    expect(text).not.toContain("请把下面内容作为当前对话目标");
  });

  it("builds a target-aware acceptance start block", () => {
    const active = makeSessionGoal("让验收像 mood 一样可见，并打开 http://localhost:3000 检查页面");
    const block = buildSessionGoalAcceptanceBlock(active, { locale: "zh-CN" });
    expect(block).toMatchObject({
      type: "goal_acceptance",
      title: "验真",
    });
    expect(block.text).toContain("这次要验的是：让验收像 mood 一样可见");
    expect(block.text).toContain("真实画布");
    expect(block.text).toContain("指针交互");
    expect(block.aspects).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "visibility" }),
      expect.objectContaining({ key: "web" }),
      expect.objectContaining({ key: "evidence" }),
    ]));
    expect(block.text).not.toContain("<mood>");
    expect(block.text).not.toContain("<验收>");
    expect(block.text).not.toContain("<验真>");
    expect(block.text).not.toContain("气：");
    expect(block.text).not.toContain("象：");
    expect(block.text).not.toContain("凝：");
    expect(block.text).not.toContain("愿：");
    expect(buildSessionGoalAcceptanceBlock({ ...active, status: "paused" }, { locale: "zh-CN" })).toBeNull();
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
    expect(result.messages[2].display).toBe(false);
    expect(result.messages[2].content).toContain("finish the feature");
    expect(result.messages[2].content).toContain("<objective>");
  });
});
