/**
 * 消息发送前净化器 — capability-aware message adaptation layer
 *
 * 职责：按 Pi SDK Model.input 声明的输入模态，把历史 messages 里不兼容的
 * content block 替换为 TextContent 占位。目前处理 ImageContent / VideoContent；
 * 未来可扩展 AudioContent。
 *
 * 定位：注册为 Pi SDK "context" extension event handler（engine.js 内）。
 * "context" 事件在每次 LLM 调用前触发，允许修改 messages。
 *
 * 非静默降级：调用方（engine）根据返回的 stripped 计数决定是否通过事件总线
 * 通知 UI，避免用户悄无声息地丢失信息。
 */
import { modelSupportsDirectVideoInput, modelSupportsVideoInput } from "../shared/model-capabilities.js";

const IMAGE_PLACEHOLDER_TEXT = "[图片已省略：当前模型不支持图像输入]";
const VIDEO_PLACEHOLDER_TEXT = "[视频已省略：当前模型不支持视频输入]";
const ASSISTANT_GENERATED_IMAGE_PLACEHOLDER_TEXT = "[生成图片已省略：图片文件已保存到本次对话，不会把图片二进制重放进模型上下文]";
const VISIBLE_COMMENTARY_TAG_PATTERN = /<(?:mood|pulse|reflect)(?:\s|>|\/)/i;

/**
 * 模型是否支持 image 输入（Pi SDK 标准字段 input 数组）。
 * @param {{ input?: readonly string[] } | null | undefined} model
 */
export function modelSupportsImage(model) {
  const input = model?.input;
  return Array.isArray(input) && input.includes("image");
}

/**
 * 模型是否支持 video 输入（Hana 扩展能力，兼容读取旧 input 数组）。
 * @param {{ input?: readonly string[] } | null | undefined} model
 */
export function modelSupportsVideo(model) {
  return modelSupportsVideoInput(model);
}

/**
 * 对 messages 做 provider 能力适配。
 *
 * @param {ReadonlyArray<any>} messages
 * @param {{ input?: readonly string[] } | null | undefined} model
 * @returns {{ messages: any[], stripped: number, strippedImages: number, strippedVideos: number }}
 */
export function sanitizeMessagesForModel(messages, model) {
  if (!Array.isArray(messages)) return emptySanitizeResult(messages);
  const supportsImage = modelSupportsImage(model);
  const supportsVideo = modelSupportsDirectVideoInput(model);
  if (supportsImage && supportsVideo) return emptySanitizeResult(messages);

  // 快速探测：没有任何需要剥离的媒体 block 就返回原数组，避免无谓分配
  if (!hasUnsupportedMediaContent(messages, { supportsImage, supportsVideo })) {
    return emptySanitizeResult(messages);
  }

  let strippedImages = 0;
  let strippedVideos = 0;
  const out = messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    // 只扫可能携带 ImageContent 的消息种类：
    //  - user（UserMessage.content 可以是 (text|image)[])
    //  - toolResult（ToolResultMessage.content 可以是 (text|image)[])
    if (msg.role !== "user" && msg.role !== "toolResult") return msg;
    if (typeof msg.content === "string") return msg;
    if (!Array.isArray(msg.content)) return msg;

    let localStripped = 0;
    const newContent = [];
    for (const block of msg.content) {
      if (block && typeof block === "object" && block.type === "image" && !supportsImage) {
        localStripped++;
        strippedImages++;
        newContent.push({ type: "text", text: IMAGE_PLACEHOLDER_TEXT });
      } else if (block && typeof block === "object" && block.type === "video" && !supportsVideo) {
        localStripped++;
        strippedVideos++;
        newContent.push({ type: "text", text: VIDEO_PLACEHOLDER_TEXT });
      } else {
        newContent.push(block);
      }
    }
    if (localStripped === 0) return msg;
    return { ...msg, content: newContent };
  });

  const stripped = strippedImages + strippedVideos;
  return { messages: out, stripped, strippedImages, strippedVideos };
}

/**
 * 原生 Responses image_generation 会把生成结果作为 assistant image block 写入
 * session，UI 会另行持久化为 session file。下一轮 LLM 调用只需要知道这里曾经
 * 生成过图片，不能重放大块 base64，也不能继续重放同一 Responses turn 的
 * encrypted reasoning / output item id，否则第三方 OpenAI-compatible 网关容易
 * 在缺失 image_generation_call replay 项时返回 5xx。
 *
 * @param {ReadonlyArray<any>} messages
 * @returns {{ messages: any[], stripped: number, strippedImages: number, strippedThinking: number, strippedTextSignatures: number }}
 */
export function sanitizeAssistantGeneratedImagesForContext(messages) {
  if (!Array.isArray(messages)) {
    return emptyAssistantGeneratedImageResult(messages);
  }
  if (!hasAssistantInlineImages(messages)) {
    return emptyAssistantGeneratedImageResult(messages);
  }

  let strippedImages = 0;
  let strippedThinking = 0;
  let strippedTextSignatures = 0;
  let mergedTextBlocks = 0;

  const out = messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) return msg;
    if (!msg.content.some(isInlineImageBlock)) return msg;

    const textParts = [];
    let localChanged = false;
    let textBlocks = 0;

    for (const block of msg.content) {
      if (isInlineImageBlock(block)) {
        strippedImages++;
        localChanged = true;
        appendAssistantContextTextPart(textParts, ASSISTANT_GENERATED_IMAGE_PLACEHOLDER_TEXT);
        continue;
      }

      if (block && typeof block === "object" && block.type === "thinking") {
        strippedThinking++;
        localChanged = true;
        continue;
      }

      if (block && typeof block === "object" && block.type === "text" && block.textSignature) {
        strippedTextSignatures++;
        textBlocks++;
        appendAssistantContextTextPart(textParts, block.text);
        localChanged = true;
        continue;
      }

      if (block && typeof block === "object" && block.type === "text") {
        textBlocks++;
        appendAssistantContextTextPart(textParts, block.text);
        localChanged = true;
        continue;
      }

      if (block && typeof block === "object" && Object.prototype.hasOwnProperty.call(block, "textSignature")) {
        strippedTextSignatures++;
        localChanged = true;
      }
    }

    if (!localChanged) return msg;
    if (textBlocks > 1 || (textBlocks > 0 && strippedImages > 0)) {
      mergedTextBlocks++;
    }
    const mergedText = textParts.join("\n\n").trim();
    const next = {
      ...msg,
      content: mergedText ? [{ type: "text", text: mergedText }] : [],
    };
    if (Object.prototype.hasOwnProperty.call(next, "responseId")) {
      delete next.responseId;
    }
    return next;
  });

  return {
    messages: out,
    stripped: strippedImages,
    strippedImages,
    strippedThinking,
    strippedTextSignatures,
    mergedTextBlocks,
  };
}

/**
 * Responses textSignature 中 phase=commentary 的普通 text block 是过程态文本，
 * 不应进入可见正文或下一轮模型上下文。保留 mood/pulse/reflect 这类已声明的
 * 可见结构块；签名缺失、签名解析失败或未知 phase 时保守放行。
 *
 * @param {any} block
 * @returns {boolean}
 */
export function isVisibleAssistantTextBlock(block) {
  if (!block || typeof block !== "object") return true;
  if (block.type !== "text") return true;
  if (!Object.prototype.hasOwnProperty.call(block, "textSignature")) return true;

  const signature = parseTextSignature(block.textSignature);
  if (!signature || signature.phase !== "commentary") return true;

  const text = typeof block.text === "string" ? block.text : "";
  return VISIBLE_COMMENTARY_TAG_PATTERN.test(text);
}

/**
 * @param {any} content
 * @returns {any}
 */
export function sanitizeVisibleAssistantTextBlocks(content) {
  if (!Array.isArray(content)) return content;
  let changed = false;
  const out = [];
  for (const block of content) {
    if (isVisibleAssistantTextBlock(block)) {
      out.push(block);
    } else {
      changed = true;
    }
  }
  return changed ? out : content;
}

/**
 * 过滤上下文中不该 replay 给模型的 assistant commentary 文本。
 *
 * @param {ReadonlyArray<any>} messages
 * @returns {{ messages: any[], stripped: number }}
 */
export function sanitizeAssistantCommentaryForContext(messages) {
  if (!Array.isArray(messages)) return { messages, stripped: 0 };
  let stripped = 0;
  let changed = false;
  const out = messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) return msg;
    const nextContent = [];
    for (const block of msg.content) {
      if (isVisibleAssistantTextBlock(block)) {
        nextContent.push(block);
      } else {
        stripped++;
        changed = true;
      }
    }
    if (nextContent.length === msg.content.length) return msg;
    return { ...msg, content: nextContent };
  });
  return { messages: changed ? out : messages, stripped };
}

function emptySanitizeResult(messages) {
  return { messages, stripped: 0, strippedImages: 0, strippedVideos: 0 };
}

function emptyAssistantGeneratedImageResult(messages) {
  return {
    messages,
    stripped: 0,
    strippedImages: 0,
    strippedThinking: 0,
    strippedTextSignatures: 0,
    mergedTextBlocks: 0,
  };
}

/** 快速判断 messages 里是否存在至少一个当前模型不支持的媒体 block。 */
function hasUnsupportedMediaContent(messages, { supportsImage, supportsVideo }) {
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "toolResult") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "image" && !supportsImage) return true;
      if (block.type === "video" && !supportsVideo) return true;
    }
  }
  return false;
}

function hasAssistantInlineImages(messages) {
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    if (msg.content.some(isInlineImageBlock)) return true;
  }
  return false;
}

function isInlineImageBlock(block) {
  return Boolean(
    block
      && typeof block === "object"
      && block.type === "image"
      && (block.data || block.source?.data),
  );
}

function appendAssistantContextTextPart(parts, text) {
  const value = typeof text === "string" ? text.trim() : "";
  if (value) parts.push(value);
}

function parseTextSignature(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
