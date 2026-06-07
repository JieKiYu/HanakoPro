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

export function createSessionGoalTool(deps = {}) {
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

      return toolOk(
        t(action === "blocked" ? "toolDef.sessionGoal.blocked" : "toolDef.sessionGoal.complete", {
          objective: getGoalObjective(result?.goal || currentGoal),
        }),
        {
          action,
          sessionPath,
          goal: result?.goal || null,
        },
      );
    },
  };
}
