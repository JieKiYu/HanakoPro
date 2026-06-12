import { AssistantMessageEventStream } from "@mariozechner/pi-ai";
import { isAbortLikeError } from "../../shared/abort-errors.js";
import { createModuleLogger } from "../debug-log.js";

const STREAM_GUARD_FLAG = Symbol.for("hana.piSdk.streamGuardInstalled");
const DEFAULT_ASSISTANT_STREAM_IDLE_TIMEOUT_MS = 90_000;
const DEFAULT_ASSISTANT_STREAM_RETURN_TIMEOUT_MS = 1_000;
const log = createModuleLogger("pi-stream");

export function installAssistantStreamGuard(session) {
  const agent = session?.agent;
  if (!agent || typeof agent.streamFn !== "function" || agent[STREAM_GUARD_FLAG]) return;
  const originalStreamFn = agent.streamFn;
  agent.streamFn = async (model, context, options) => {
    const requestMeta = {
      api: model?.api || "unknown",
      provider: model?.provider || "unknown",
      model: model?.id || "unknown",
      messageCount: Array.isArray(context?.messages) ? context.messages.length : 0,
      toolCount: Array.isArray(context?.tools) ? context.tools.length : 0,
    };
    log.log(
      `assistant stream start provider=${requestMeta.provider} model=${requestMeta.model} `
      + `api=${requestMeta.api} messages=${requestMeta.messageCount} tools=${requestMeta.toolCount}`
    );
    const inner = await originalStreamFn(model, context, options);
    return guardAssistantMessageStream(inner, (event) => {
      if (typeof session._emit === "function") {
        session._emit(event);
      }
    }, { requestMeta });
  };
  agent[STREAM_GUARD_FLAG] = true;
}

export function guardAssistantMessageStream(inner, onToolCallEvent = null, options = {}) {
  const outer = new AssistantMessageEventStream();
  const state = createGuardState();
  const requestMeta = normalizeRequestMeta(options.requestMeta);
  const idleTimeoutMs = resolveAssistantStreamIdleTimeoutMs(options.idleTimeoutMs);
  const returnTimeoutMs = resolveAssistantStreamReturnTimeoutMs(options.returnTimeoutMs);

  void (async () => {
    const iterator = inner?.[Symbol.asyncIterator]?.();
    if (!iterator || typeof iterator.next !== "function") {
      outer.push({
        type: "error",
        reason: "error",
        error: createErrorMessage(new Error("模型流不可读取：底层没有返回有效的异步事件流。"), false, requestMeta),
      });
      outer.end();
      return;
    }
    let eventCount = 0;
    try {
      while (true) {
        const next = await nextStreamEvent(iterator, idleTimeoutMs, {
          requestMeta,
          eventCount,
        });
        if (next.done) break;
        const event = next.value;
        eventCount += 1;
        for (const guarded of guardStreamEvent(event, state)) {
          if (isToolCallStreamEvent(guarded) && typeof onToolCallEvent === "function") {
            try {
              onToolCallEvent(guarded);
            } catch {}
          }
          outer.push(guarded);
        }
      }
    } catch (error) {
      const aborted = isAbortLikeError(error);
      if (isAssistantStreamIdleTimeoutError(error)) {
        log.warn(
          `assistant stream idle: provider=${requestMeta.provider} model=${requestMeta.model} `
          + `api=${requestMeta.api} events=${eventCount} idleMs=${idleTimeoutMs}`
        );
      }
      await settleIteratorReturn(iterator, returnTimeoutMs);
      outer.push({
        type: "error",
        reason: aborted ? "aborted" : "error",
        error: createErrorMessage(error, aborted, requestMeta),
      });
    }
    outer.end();
  })();

  return outer;
}

function resolveAssistantStreamIdleTimeoutMs(value) {
  const explicit = normalizePositiveInteger(value);
  if (explicit !== null) return explicit;
  const fromEnv = normalizePositiveInteger(process.env.HANA_ASSISTANT_STREAM_IDLE_TIMEOUT_MS);
  if (fromEnv !== null) return fromEnv;
  return DEFAULT_ASSISTANT_STREAM_IDLE_TIMEOUT_MS;
}

function resolveAssistantStreamReturnTimeoutMs(value) {
  const explicit = normalizePositiveInteger(value);
  return explicit === null ? DEFAULT_ASSISTANT_STREAM_RETURN_TIMEOUT_MS : explicit;
}

function normalizePositiveInteger(value) {
  if (value === 0 || value === "0") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function settleIteratorReturn(iterator, returnTimeoutMs) {
  if (typeof iterator?.return !== "function") return;
  try {
    const pendingReturn = iterator.return();
    if (!returnTimeoutMs) {
      await pendingReturn;
      return;
    }
    let timeoutId = null;
    try {
      await Promise.race([
        pendingReturn,
        new Promise((resolve) => {
          timeoutId = setTimeout(resolve, returnTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch {}
}

async function nextStreamEvent(iterator, idleTimeoutMs, context) {
  if (!idleTimeoutMs) return iterator.next();
  let timeoutId = null;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createAssistantStreamIdleTimeoutError(idleTimeoutMs, context));
        }, idleTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function createAssistantStreamIdleTimeoutError(idleTimeoutMs, { requestMeta, eventCount }) {
  const seconds = Math.round(idleTimeoutMs / 1000);
  const stage = eventCount > 0 ? "上一段模型事件之后" : "请求发出之后";
  const err = new Error(
    `模型续跑静默过久：工具结果已返回，但${stage} ${seconds} 秒内没有新的思考、正文、工具调用或结束信号。`
  );
  err.name = "AssistantStreamIdleTimeoutError";
  err.code = "HANA_ASSISTANT_STREAM_IDLE_TIMEOUT";
  err.requestMeta = requestMeta;
  return err;
}

function isAssistantStreamIdleTimeoutError(error) {
  return error?.code === "HANA_ASSISTANT_STREAM_IDLE_TIMEOUT";
}

function normalizeRequestMeta(value = {}) {
  return {
    api: typeof value.api === "string" && value.api ? value.api : "unknown",
    provider: typeof value.provider === "string" && value.provider ? value.provider : "unknown",
    model: typeof value.model === "string" && value.model ? value.model : "unknown",
  };
}

function isToolCallStreamEvent(event) {
  return event?.type === "toolcall_start" || event?.type === "toolcall_delta" || event?.type === "toolcall_end";
}

function createGuardState() {
  return {
    invalidToolCalls: new Map(),
  };
}

function guardStreamEvent(event, state) {
  if (!event || typeof event !== "object") return [];
  if (event.type === "toolcall_start" || event.type === "toolcall_delta") {
    const toolCall = toolCallFromEvent(event);
    if (isEmptyNameToolCall(toolCall)) {
      bufferInvalidToolCallEvent(state, event, toolCall);
      return [];
    }
    return [{ ...event, partial: sanitizeAssistantMessage(event.partial, state) }];
  }
  if (event.type === "toolcall_end") {
    const toolCall = toolCallFromEvent(event);
    if (isEmptyNameToolCall(toolCall)) {
      bufferInvalidToolCallEvent(state, event, toolCall);
      const text = recoverInvalidToolCallText(toolCall, getBufferedInvalidToolCallText(state, event, toolCall));
      if (!text) return [];
      recordRecoveredInvalidToolCallText(state, event, toolCall, text);
      const partial = sanitizeAssistantMessage(event.partial, state);
      const contentIndex = Math.max(0, partial.content.length - 1);
      return [
        { type: "text_start", contentIndex, partial },
        { type: "text_delta", contentIndex, delta: text, partial },
        { type: "text_end", contentIndex, content: text, partial },
      ];
    }
    return [{ ...event, partial: sanitizeAssistantMessage(event.partial, state) }];
  }
  if (event.type === "done") {
    return [{ ...event, message: sanitizeAssistantMessage(event.message, state) }];
  }
  if (event.type === "error") {
    return [{ ...event, error: sanitizeAssistantMessage(event.error, state) }];
  }
  if ("partial" in event) {
    return [{ ...event, partial: sanitizeAssistantMessage(event.partial, state) }];
  }
  return [event];
}

function toolCallFromEvent(event) {
  if (event.toolCall?.type === "toolCall") return event.toolCall;
  const content = event.partial?.content;
  if (Array.isArray(content) && typeof event.contentIndex === "number") {
    return content[event.contentIndex];
  }
  return null;
}

function isEmptyNameToolCall(block) {
  return block?.type === "toolCall" && String(block.name || "").trim().length === 0;
}

export function sanitizeAssistantMessage(message, state = null) {
  if (!message || !Array.isArray(message.content)) return message;
  const content = [];
  message.content.forEach((block, index) => {
    if (isEmptyNameToolCall(block)) {
      appendTextBlock(content, recoverInvalidToolCallText(block, getRecoveredInvalidToolCallText(state, block, index)));
      return;
    }
    content.push(block);
  });
  return { ...message, content };
}

function appendTextBlock(content, text) {
  if (!text) return;
  const last = content[content.length - 1];
  if (last?.type === "text") {
    last.text += text;
    return;
  }
  content.push({ type: "text", text });
}

function recoverInvalidToolCallText(block, bufferedText = "") {
  const raw = bufferedText || rawPartialArgs(block);
  const parsed = parseJsonLike(raw);
  const fromParsed = recoverTextFromValue(parsed ?? block?.arguments);
  if (fromParsed) return fromParsed;

  const text = raw.trim();
  if (!text) return "";
  if (text.startsWith("{") || text.startsWith("[")) return "";
  return raw;
}

function rawPartialArgs(block) {
  return typeof block?.partialArgs === "string" ? block.partialArgs : "";
}

function invalidToolCallKey(event, block) {
  if (block?.id) return `id:${block.id}`;
  if (typeof event?.contentIndex === "number") return `index:${event.contentIndex}`;
  return "index:0";
}

function invalidToolCallIndex(event) {
  return typeof event?.contentIndex === "number" ? event.contentIndex : 0;
}

function getInvalidToolCallState(state, event, block) {
  if (!state) return null;
  const key = invalidToolCallKey(event, block);
  const existing = state.invalidToolCalls.get(key);
  if (existing) return existing;
  const entry = {
    raw: "",
    lastPartialArgs: "",
    contentIndex: invalidToolCallIndex(event),
    recoveredText: "",
  };
  state.invalidToolCalls.set(key, entry);
  return entry;
}

function bufferInvalidToolCallEvent(state, event, block) {
  const entry = getInvalidToolCallState(state, event, block);
  if (!entry) return;
  if (typeof event?.delta === "string") {
    entry.raw += event.delta;
    const partial = rawPartialArgs(block);
    if (partial) entry.lastPartialArgs = partial;
    return;
  }

  const partial = rawPartialArgs(block);
  if (!partial) return;
  if (partial.startsWith(entry.lastPartialArgs)) {
    entry.raw += partial.slice(entry.lastPartialArgs.length);
  } else if (!entry.raw.endsWith(partial)) {
    entry.raw += partial;
  }
  entry.lastPartialArgs = partial;
}

function getBufferedInvalidToolCallText(state, event, block) {
  const entry = getInvalidToolCallState(state, event, block);
  return entry?.raw || "";
}

function recordRecoveredInvalidToolCallText(state, event, block, text) {
  const entry = getInvalidToolCallState(state, event, block);
  if (entry) entry.recoveredText = text;
}

function getRecoveredInvalidToolCallText(state, block, index) {
  if (!state) return "";
  if (block?.id) {
    const byId = state.invalidToolCalls.get(`id:${block.id}`)?.recoveredText;
    if (byId) return byId;
  }
  return state.invalidToolCalls.get(`index:${index}`)?.recoveredText || "";
}

function recoverTextFromValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  for (const key of ["text", "content", "message", "body", "input"]) {
    if (typeof value[key] === "string") return value[key];
  }
  return "";
}

function parseJsonLike(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || (!text.startsWith("{") && !text.startsWith("[") && !text.startsWith("\""))) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createErrorMessage(error, aborted = false, requestMeta = null) {
  const meta = normalizeRequestMeta(requestMeta);
  return {
    role: "assistant",
    content: [],
    api: meta.api,
    provider: meta.provider,
    model: meta.model,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: aborted ? "aborted" : "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp: Date.now(),
  };
}
