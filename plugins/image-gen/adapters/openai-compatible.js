// plugins/image-gen/adapters/openai-compatible.js
import fs from "fs";
import path from "path";
import { saveImage } from "../lib/download.js";

const FORMAT_TO_MIME = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const RATIO_TO_SIZE = {
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "3:4": "1024x1536",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

function resolveTargetProvider(params, ctx) {
  return params.provider || ctx.providerOverride || ctx.config?.get?.("defaultImageModel")?.provider || "";
}

function resolveTargetModel(params, ctx) {
  return params.model || ctx.config?.get?.("defaultImageModel")?.id || "";
}

function normalizeImages(image) {
  if (!image) return null;
  const images = Array.isArray(image) ? image : [image];
  return images.map((img) => {
    if (path.isAbsolute(img) && fs.existsSync(img)) {
      const buf = fs.readFileSync(img);
      const ext = path.extname(img).slice(1).toLowerCase();
      const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[ext] || "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
    return img;
  });
}

async function resolveCredentials(providerId, ctx) {
  if (!providerId) return null;
  const creds = await ctx.bus.request("provider:credentials", { providerId });
  if (creds?.error || !creds?.apiKey || !creds?.baseUrl) return null;
  return creds;
}

export const openaiCompatibleImageAdapter = {
  id: "openai-compatible",
  name: "OpenAI-compatible Image",
  types: ["image"],
  capabilities: {
    ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
    resolutions: [],
  },

  async checkAuth(ctx) {
    try {
      const providerId = resolveTargetProvider({}, ctx);
      const creds = await resolveCredentials(providerId, ctx);
      return creds
        ? { ok: true }
        : { ok: false, message: "未配置图片 provider" };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  },

  async submit(params, ctx) {
    const providerId = resolveTargetProvider(params, ctx);
    const creds = await resolveCredentials(providerId, ctx);
    if (!creds) {
      throw new Error(`Provider "${providerId || "unknown"}" 未配置可用的图片生成凭证。`);
    }

    const modelId = resolveTargetModel(params, ctx);
    if (!modelId) {
      throw new Error(`Provider "${providerId}" 未配置默认图片模型。`);
    }

    const allDefaults = ctx.config?.get?.("providerDefaults") || {};
    const providerDefaults = allDefaults[providerId] || {};
    const outputFormat = params.format || providerDefaults?.format || "png";
    const effectiveRatio = params.aspect_ratio || params.aspectRatio || params.ratio || providerDefaults?.aspect_ratio;
    const body = {
      model: modelId,
      prompt: params.prompt,
      n: 1,
      output_format: outputFormat,
    };

    if (params.size || params.resolution) {
      body.size = params.size || params.resolution;
    } else if (effectiveRatio && RATIO_TO_SIZE[effectiveRatio]) {
      body.size = RATIO_TO_SIZE[effectiveRatio];
    } else if (providerDefaults?.size || providerDefaults?.resolution) {
      body.size = providerDefaults.size || providerDefaults.resolution;
    }

    const quality = params.quality || providerDefaults?.quality;
    if (quality) body.quality = quality;
    if (providerDefaults?.background) body.background = providerDefaults.background;

    const images = normalizeImages(params.image);
    if (images) body.image = images;

    const base = creds.baseUrl.replace(/\/+$/, "");
    const endpoint = body.image
      ? `${base}/images/edits`
      : `${base}/images/generations`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try {
        const err = await res.json();
        if (err.error?.message) msg = `${msg}: ${err.error.message}`;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    const responseImages = data.data || [];
    if (responseImages.length === 0) {
      throw new Error("API returned no images");
    }

    const mimeType = FORMAT_TO_MIME[outputFormat] || "image/png";
    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const files = [];
    for (let i = 0; i < responseImages.length; i++) {
      const buffer = Buffer.from(responseImages[i].b64_json, "base64");
      const customName = params.filename
        ? (responseImages.length > 1 ? `${params.filename}-${i + 1}` : params.filename)
        : null;
      const { filename } = await saveImage(buffer, mimeType, ctx.dataDir, customName);
      files.push(filename);
    }
    return { taskId, files };
  },
};
