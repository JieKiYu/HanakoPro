/**
 * OpenAI Responses replay 兼容层
 *
 * 处理 provider:
 *   - api === "openai-responses"
 *
 * 解决的协议问题：
 *   Pi SDK 会把同模型历史 assistant turn 的 encrypted reasoning 作为
 *   Responses `input` 里的 `reasoning` item 回放。这个 replay 只有在同一
 *   turn 的全部 output items 都能一并回放时才安全。Hana 原生生图会把
 *   `image_generation_call` 结果持久化为 assistant image block；当前
 *   serializer 无法把该 block 还原成 Responses `image_generation_call`
 *   input item，第三方 OpenAI-compatible 网关会在缺项 replay 时返回 5xx。
 *
 * 删除条件：
 *   - Pi SDK 能把 assistant image_generation_call 历史完整序列化回
 *     Responses input；或 Responses provider 明确接受缺失 image call 的
 *     encrypted reasoning replay。
 */

function lower(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function matches(model) {
  if (!model || typeof model !== "object") return false;
  return lower(model.api) === "openai-responses";
}

export function apply(payload) {
  return stripUnsafeStandaloneReasoningReplay(payload);
}

export function stripUnsafeStandaloneReasoningReplay(payload) {
  if (!Array.isArray(payload?.input)) return payload;

  let changed = false;
  const input = [];
  const items = payload.input;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isReasoningInputItem(item)) {
      input.push(item);
      continue;
    }

    if (assistantReplayGroupHasFunctionCall(items, i + 1)) {
      input.push(item);
      continue;
    }

    changed = true;
  }

  return changed ? { ...payload, input } : payload;
}

function isReasoningInputItem(item) {
  return isPlainObject(item) && item.type === "reasoning";
}

function isAssistantMessageInputItem(item) {
  return isPlainObject(item) && item.type === "message" && item.role === "assistant";
}

function isFunctionCallInputItem(item) {
  return isPlainObject(item) && item.type === "function_call";
}

function isReplayBoundary(item) {
  if (!isPlainObject(item)) return true;
  if (item.type === "function_call_output") return true;
  if (item.role === "user" || item.role === "system" || item.role === "developer") return true;
  if (item.type === "reasoning") return true;
  return false;
}

function assistantReplayGroupHasFunctionCall(items, startIndex) {
  for (let i = startIndex; i < items.length; i++) {
    const item = items[i];
    if (isFunctionCallInputItem(item)) return true;
    if (isAssistantMessageInputItem(item)) continue;
    if (isReplayBoundary(item)) return false;
  }
  return false;
}
