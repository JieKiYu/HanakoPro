import { describe, expect, it, vi } from "vitest";
import { applyNativeImageGenerationDefaults } from "../core/engine.js";

function makePluginManager(values) {
  return {
    getConfig: vi.fn(() => ({ values })),
  };
}

describe("native Responses image generation defaults", () => {
  it("does not attach native image_generation to ordinary chat requests", () => {
    const payload = {
      model: "gpt-5.5",
      stream: true,
      tools: [{ type: "function", name: "read" }],
    };
    const pluginManager = makePluginManager({
      defaultImageModel: { provider: "k+", id: "gpt-image-2" },
      providerDefaults: {
        "k+": { size: "4K", quality: "high", format: "png" },
      },
    });

    const result = applyNativeImageGenerationDefaults(
      payload,
      { api: "openai-responses", provider: "k+", id: "gpt-5.5" },
      pluginManager,
    );

    expect(result).toBe(payload);
    expect(result.tools).toEqual([{ type: "function", name: "read" }]);
  });

  it("overrides an existing native image_generation tool with the multimedia defaults", () => {
    const payload = {
      model: "gpt-5.5",
      tools: [
        { type: "image_generation", size: "2K", output_format: "jpeg" },
      ],
    };
    const pluginManager = makePluginManager({
      defaultImageModel: { provider: "k+", id: "gpt-image-2" },
      providerDefaults: {
        "k+": { size: "4K", quality: "high", format: "png" },
      },
    });

    const result = applyNativeImageGenerationDefaults(
      payload,
      { api: "openai-responses", provider: "k+", id: "gpt-5.5" },
      pluginManager,
    );

    expect(result.tools).toEqual([
      {
        type: "image_generation",
        size: "4K",
        output_format: "png",
        quality: "high",
      },
    ]);
  });

  it("does not attach defaults to unrelated providers", () => {
    const payload = {
      model: "gpt-5.5",
      stream: true,
    };
    const pluginManager = makePluginManager({
      defaultImageModel: { provider: "k+", id: "gpt-image-2" },
      providerDefaults: {
        "k+": { size: "4K" },
      },
    });

    const result = applyNativeImageGenerationDefaults(
      payload,
      { api: "openai-responses", provider: "openai", id: "gpt-5.5" },
      pluginManager,
    );

    expect(result).toBe(payload);
  });
});
