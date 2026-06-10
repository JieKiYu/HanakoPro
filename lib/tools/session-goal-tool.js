/**
 * session-goal-tool.js — let the agent close or block the current session goal.
 */

import { StringEnum, Type } from "../pi-sdk/index.js";
import { t } from "../../server/i18n.js";
import { getToolSessionPath } from "./tool-session.js";
import { toolError, toolOk } from "./tool-result.js";

const SESSION_GOAL_ACTIONS = ["complete", "blocked"];

function getGoalObjective(goal) {
  return typeof goal?.objective === "string" ? goal.objective : "";
}

function finiteNonNegativeInteger(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function formatElapsedZh(ms) {
  const safeMs = finiteNonNegativeInteger(ms);
  if (safeMs === null) return "未知";
  const totalSeconds = Math.max(0, Math.round(safeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds} 秒`;
}

function formatGoalUsageLine(goal) {
  const metrics = goal?.metrics && typeof goal.metrics === "object" ? goal.metrics : {};
  const tokens = finiteNonNegativeInteger(metrics.tokenUsage ?? metrics.estimatedTokens);
  const elapsedMs = finiteNonNegativeInteger(metrics.elapsedMs ?? goal?.elapsedMs);
  const tokenText = tokens === null ? "未记录" : String(tokens);
  return `目标用量：${tokenText} tokens，用时约 ${formatElapsedZh(elapsedMs)}。`;
}

function completionSummary(goal) {
  const note = typeof goal?.note === "string" ? goal.note.trim() : "";
  const evidence = note || "验收已通过，目标终态已确认。";
  const conclusion = evidence.startsWith("验真已合")
    ? evidence
    : `验真已合：${evidence}`;
  return `${conclusion}\n${formatGoalUsageLine(goal)}`;
}

export function createSessionGoalTool(deps = {}) {
  async function cleanupComputerUse(sessionPath, ctx) {
    try {
      const host = deps.getComputerHost?.()
        || deps.getEngine?.()?.getComputerHost?.()
        || null;
      if (!host || typeof host.stop !== "function") return null;
      return await host.stop({
        sessionPath,
        agentId: ctx?.agentId || deps.getAgentId?.(sessionPath) || null,
        model: ctx?.model || null,
      });
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
      };
    }
  }

  return {
    name: "session_goal",
    label: t("toolDef.sessionGoal.label"),
    description: t("toolDef.sessionGoal.description"),
    parameters: Type.Object({
      action: StringEnum(SESSION_GOAL_ACTIONS, {
        description: t("toolDef.sessionGoal.actionDesc"),
      }),
      note: Type.Optional(Type.String({
        description: t("toolDef.sessionGoal.noteDesc"),
      })),
    }),

    execute: async (_toolCallId, params = {}, _signal, _onUpdate, ctx) => {
      const sessionPath = getToolSessionPath(ctx) || deps.getSessionPath?.() || null;
      if (!sessionPath) {
        return toolError(t("toolDef.sessionGoal.missingSession"), { action: params.action || null });
      }

      const engine = deps.getEngine?.();
      const currentGoal = engine?.getSessionGoal?.(sessionPath) || null;
      if (!currentGoal || currentGoal.status !== "active") {
        return toolError(t("toolDef.sessionGoal.missingGoal"), { sessionPath });
      }

      const action = params.action === "blocked" ? "blocked" : "complete";
      const note = typeof params.note === "string" ? params.note : null;
      const result = action === "blocked"
        ? engine?.markSessionGoalBlocked?.(sessionPath, note)
        : engine?.markSessionGoalComplete?.(sessionPath, note);

      if (result?.ok === false) {
        return toolError(result.error || t("toolDef.sessionGoal.failed"), {
          action,
          sessionPath,
          goal: result.goal || currentGoal,
        });
      }

      const computerCleanup = await cleanupComputerUse(sessionPath, ctx);

      const finalGoal = result?.goal || null;
      const summary = action === "blocked"
        ? t("toolDef.sessionGoal.blocked", {
          objective: getGoalObjective(finalGoal || currentGoal),
        })
        : completionSummary(finalGoal || currentGoal);

      return toolOk(
        summary || t(action === "blocked" ? "toolDef.sessionGoal.blocked" : "toolDef.sessionGoal.complete", {
          objective: getGoalObjective(result?.goal || currentGoal),
        }),
        {
          action,
          sessionPath,
          goal: finalGoal,
          metrics: finalGoal?.metrics || null,
          summary,
          computerCleanup,
        },
      );
    },
  };
}
