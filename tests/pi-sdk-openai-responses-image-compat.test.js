import { describe, expect, it } from "vitest";
import { processResponsesStream } from "../node_modules/@mariozechner/pi-ai/dist/providers/openai-responses-shared.js";
import { AssistantMessageEventStream } from "../node_modules/@mariozechner/pi-ai/dist/utils/event-stream.js";

async function* events(items) {
  for (const item of items) yield item;
}

function zeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

describe("Pi SDK OpenAI Responses image generation compat", () => {
  it("preserves image_generation_call results as assistant image content", async () => {
    const fakeB64 = Buffer.from("fake-native-response-image").toString("base64");
    const output = {
      role: "assistant",
      content: [],
      api: "openai-responses",
      provider: "k+",
      model: "gpt-5.5",
      usage: zeroUsage(),
      stopReason: "stop",
      timestamp: Date.now(),
    };
    const stream = new AssistantMessageEventStream();
    const model = {
      id: "gpt-5.5",
      api: "openai-responses",
      provider: "k+",
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };

    await processResponsesStream(events([
      { type: "response.created", response: { id: "resp_img" } },
      { type: "response.output_item.added", item: { id: "ig_1", type: "image_generation_call" } },
      { type: "response.output_item.done", item: { id: "ig_1", type: "image_generation_call", result: fakeB64 } },
      {
        type: "response.completed",
        response: {
          id: "resp_img",
          status: "completed",
          usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3, input_tokens_details: { cached_tokens: 0 } },
        },
      },
    ]), output, stream, model);

    expect(output.content).toContainEqual({
      type: "image",
      data: fakeB64,
      mimeType: "image/png",
    });
  });
});
