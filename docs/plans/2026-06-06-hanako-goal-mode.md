# Hanako Goal Mode Design

## Context

Hanako already has session-owned state for permission mode, thinking level, memory
state, prompt snapshots, todos, and context usage. Goal mode should follow that
shape: a lightweight session state that is visible in the chat composer and
injected into the active session context, not a separate project/task system.

The desired interaction should feel close to Codex:

- the current goal is visible as a bar at the top of the composer;
- the entry point is available from the composer `+` menu;
- slash commands are intentionally not part of this feature.

## First Pass

### Data

Persist a `goal` object in each session's `session-meta.json` entry:

```json
{
  "objective": "string",
  "status": "active | complete | blocked",
  "createdAt": "iso",
  "updatedAt": "iso",
  "completedAt": "iso?",
  "blockedAt": "iso?",
  "note": "string?"
}
```

Only `active` goals are injected into model context. Completed or blocked goals
remain in metadata for details/history, but do not steer new turns.

### Backend

- Add session-goal helpers to `SessionCoordinator`.
- Expose Engine facade methods so routes do not touch private
  coordinator state.
- Add `/api/session-goal` GET/POST for the desktop UI.
- Emit `session_goal` websocket events after changes so all windows/widgets can
  update from the same source.
- Do not register `/goal` in the slash command system. Codex removed `/goal`,
  and Hanako should keep Goal mode as a visible composer action instead.

### Prompt Injection

Inject a short system message before the latest user prompt whenever the session
has an active goal. This avoids rebuilding a frozen session prompt whenever the
goal changes, and keeps the feature scoped to the current session.

The injected block should say:

- this is the current session goal;
- keep progress oriented around it;
- use normal Hanako discipline: act when the path is clear, ask when needed,
  and only treat the goal as complete when verified.

### Frontend

- Add `sessionGoalByPath` to the session store.
- Hydrate goal on session create/switch and websocket `session_goal`.
- In `InputArea`, render a composer-top goal bar when a current session has an
  active goal.
- Replace the `+` button's direct attach behavior with a small action menu:
  `Add files` and `Goal`. `Add files` keeps existing behavior.
- The Goal action opens a compact inline editor above the composer. Saving calls
  `/api/session-goal`; empty text clears the goal.

## Non-Goals For First Pass

- Background auto-run or wakeups.
- Token budgets.
- Cross-session project goals.
- Dedicated goal dashboard.
- Automatic completion inference.
