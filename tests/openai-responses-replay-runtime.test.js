import { afterEach, describe, expect, it, vi } from "vitest";
import { convertResponsesMessages } from "../node_modules/@mariozechner/pi-ai/dist/providers/openai-responses-shared.js";
import {
  normalizeProviderContextMessages,
  normalizeProviderPayload,
} from "../core/provider-compat.js";

describe("OpenAI Responses native image replay runtime guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const model = {
    id: "gpt-5.5",
    provider: "k+",
    api: "openai-responses",
    input: ["text", "image"],
    reasoning: true,
  };

  function imageHistoryMessages() {
    return [
      {
        role: "user",
        content: [{ type: "text", text: "生成头像" }],
      },
      {
        role: "assistant",
        api: "openai-responses",
        provider: "k+",
        model: "gpt-5.5",
        responseId: "resp_img",
        content: [
          {
            type: "thinking",
            thinking: "deciding image generation",
            thinkingSignature: JSON.stringify({
              id: "rs_image_turn",
              type: "reasoning",
              summary: [],
              encrypted_content: "opaque-image-turn-reasoning",
            }),
          },
          {
            type: "text",
            text: "生成好了。",
            textSignature: JSON.stringify({
              v: 1,
              id: "msg_image_done",
              phase: "final_answer",
            }),
          },
          {
            type: "image",
            data: "PNG_BASE64",
            mimeType: "image/png",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "text", text: "继续回复" }],
      },
    ];
  }

  it("cleans assistant image history before serialization and strips unsafe reasoning at final payload", () => {
    const rawMessages = imageHistoryMessages();

    const unsafePayload = {
      model: model.id,
      input: convertResponsesMessages(model, { messages: rawMessages, systemPrompt: "" }, new Set(["k+"])),
    };
    expect(unsafePayload.input.some((item) => item.type === "reasoning")).toBe(true);

    const contextMessages = normalizeProviderContextMessages(rawMessages, model, { mode: "chat" });
    const payload = {
      model: model.id,
      input: convertResponsesMessages(model, { messages: contextMessages, systemPrompt: "" }, new Set(["k+"])),
    };
    const normalizedPayload = normalizeProviderPayload(payload, model, { mode: "chat" });

    const serialized = JSON.stringify(normalizedPayload);
    expect(serialized).not.toContain("PNG_BASE64");
    expect(serialized).not.toContain("opaque-image-turn-reasoning");
    expect(normalizedPayload.input.filter((item) => item.type === "reasoning")).toHaveLength(0);
    const assistantReplayMessages = normalizedPayload.input.filter((item) => item.type === "message" && item.role === "assistant");
    expect(assistantReplayMessages).toHaveLength(1);
    expect(assistantReplayMessages[0].content[0].text).toContain("生成好了。");
    expect(assistantReplayMessages[0].content[0].text).toContain("[生成图片已省略");
    expect(normalizedPayload.input.at(-1)).toEqual({
      role: "user",
      content: [{ type: "input_text", text: "继续回复" }],
    });
  });

  it("retains tool-call reasoning replay so normal tool history still works", () => {
    const payload = {
      model: model.id,
      input: [
        { role: "user", content: [{ type: "input_text", text: "查文件" }] },
        { type: "reasoning", id: "rs_tool", encrypted_content: "opaque-tool-reasoning" },
        { type: "function_call", id: "fc_1", call_id: "call_1", name: "read", arguments: "{}" },
        { type: "function_call_output", call_id: "call_1", output: "ok" },
        { role: "user", content: [{ type: "input_text", text: "继续" }] },
      ],
    };

    const normalizedPayload = normalizeProviderPayload(payload, model, { mode: "chat" });

    expect(normalizedPayload).toBe(payload);
    expect(normalizedPayload.input.some((item) => item.type === "reasoning")).toBe(true);
  });
});
