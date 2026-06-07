# Hanako Memory Architecture

Date: 2026-06-04

## Goal

Hanako should remember enough that the user does not have to keep saying "I told you this before", while still treating the current request, current files, and tool results as authoritative.

The memory system must be useful without being noisy. It should recall a few relevant facts or prior threads at the right time, not pour the user's whole history into every prompt.

## Four Layers

### Ding: Pinned Memory

Source: `pinned.md`

Purpose: explicit durable memory. These are user-approved long-term facts, preferences, and constraints.

Use:
- Always eligible for recall when memory is enabled.
- Injected directly into the static system prompt today.
- Also participates in dynamic recall so the model sees the most relevant pins near the current turn.

Do not store:
- Secrets, tokens, personal identifiers, or one-off task details.
- Project rules that belong in project files or `AGENTS.md`.

### Luo: Session Threads

Source: `memory/summaries/*.json`

Purpose: machine-readable summaries of previous conversations. These are not prompt text by default; they are recall material.

Use:
- Generated from completed or idle sessions when memory generation is enabled.
- Searched dynamically for task-relevant prior threads.
- Used by diary generation.

Do not inject wholesale. Only inject a few relevant summary snippets with source and time.

### Jing: Compiled Memory

Sources:
- `memory/facts.md`
- `memory/today.md`
- `memory/week.md`
- `memory/longterm.md`
- `memory/memory.md`
- `memory/facts.db`

Purpose: condensed user profile, recent themes, and stable long-term context.

Use:
- Read as recall material, not as a complete prompt blob.
- Prioritize `facts.md` and `longterm.md` for durable user context.
- Use `today.md` and `week.md` for broad recent themes.

Current behavior note: compiled memory exists but is not injected into ordinary chat. This design keeps it out of the static prompt and instead uses dynamic recall.

### Jian: Diary

Source: workspace `diary/` or `日记/`

Purpose: first-person daily continuity and reflective record.

Use:
- Diary entries can be searched as a warm narrative layer.
- Diary recall should be lower priority than pinned facts and session summaries for engineering tasks.
- Diary should feed long-term theme extraction later, but should not be treated as hard factual authority.

Do not directly use diary as proof. When a diary conflicts with code, tools, or user instruction, discard the diary.

## Controls

Memory needs two independent switches:

- `memory.enabled`: master switch. Existing setting. If false, no memory tools, no recall, no generation.
- `memory.use`: whether existing memories are recalled into future turns. Default true.
- `memory.generate`: whether current sessions may become future memory. Default true.

Session-level memory off still means the session is not written into persistent memory. It may still use existing memories if the master and use switches are enabled.

## Prompt Contract

Dynamic recall injects one hidden context block before the model call:

```text
## Hanako Recalled Memory

These memories may help with the current request. Use them only when directly relevant.
Current user request, current files, tool results, and explicit instructions override memory.
If a memory is irrelevant or conflicts with observed facts, ignore it.

- [pin] ...
- [summary] ... (source: ...)
- [longterm] ...
```

This block is not shown as a user message in the UI and is not written into the persisted conversation as user content.

## Recall Rules

Inputs:
- Current user prompt text.
- Current working directory and workspace folders.
- Active agent id.
- Recent session messages when available.

Sources:
- Pinned memories.
- Compiled memory sections.
- Session summaries.
- Recent diary entries.

Scoring:
- Lexical overlap with the current prompt.
- Workspace/path/title overlap.
- Recency bonus for recent summaries and diaries.
- Source priority: pinned > facts/longterm > session summary > today/week > diary.
- Diversity cap so one source cannot flood the block.

Limits:
- Maximum 6 recalled items.
- Maximum 1200 characters total by default.
- Skip empty, duplicate, or near-duplicate items.
- Skip the current session summary to avoid echoing the current turn.

## Generation Rules

First implementation:
- Enable the existing memory ticker when `memory.generate !== false`.
- Keep current turn-based generation behavior: every 10 turns and session end.
- Diary can still backfill missing summaries when `/diary` runs.

Safety:
- Do not generate memory when master memory is disabled.
- Respect per-session memory state.
- Keep PII scrubbing in the summary path.
- Do not make memory generation block prompt execution.

## UI

First implementation keeps settings simple:

- Main memory toggle remains the master switch.
- Add two sub toggles:
  - Use memory
  - Generate memory

Later:
- Show "last recalled memories" for the current turn.
- Add per-memory delete from recalled source.
- Add per-session "do not remember this conversation".

## Non-Goals For First Pass

- No embedding service requirement.
- No semantic vector database.
- No automatic screen/Chronicle memory.
- No direct diary injection as authoritative context.
- No complex user-facing prompt template overrides.

## Success Criteria

- A new or ongoing chat can automatically receive relevant memories without the user asking.
- Irrelevant memory stays out of the prompt most of the time.
- Pinned, compiled, summary, and diary data are all reusable through one recall path.
- Memory generation and memory use can be controlled separately.
- Tests prove that recall finds relevant prior memory and skips disabled memory.
