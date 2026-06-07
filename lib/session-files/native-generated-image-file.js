import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { sessionFilesCacheDir } from "./session-file-registry.js";
import { serializeSessionFile } from "./session-file-response.js";

export function nativeGeneratedImageExt(mimeType) {
  const lower = String(mimeType || "").toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "png";
}

export function normalizeImageBase64Data(data) {
  if (typeof data !== "string") return "";
  const trimmed = data.trim();
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(trimmed);
  return match ? match[2].trim() : trimmed;
}

export function nativeGeneratedImageFilename({ base64, mimeType } = {}) {
  const normalized = normalizeImageBase64Data(base64);
  if (!normalized) throw new Error("native generated image base64 is required");
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `generated-image-${hash}.${nativeGeneratedImageExt(mimeType)}`;
}

export function nativeGeneratedImagePath(hanakoHome, sessionPath, { base64, mimeType } = {}) {
  return path.join(
    sessionFilesCacheDir(hanakoHome, sessionPath),
    nativeGeneratedImageFilename({ base64, mimeType }),
  );
}

export function persistNativeGeneratedImageFileSync({
  hanakoHome,
  sessionPath,
  base64,
  mimeType = "image/png",
  registerSessionFile,
} = {}) {
  if (typeof registerSessionFile !== "function") {
    throw new Error("native generated image requires registerSessionFile");
  }
  const normalized = normalizeImageBase64Data(base64);
  if (!normalized) throw new Error("native generated image base64 is required");
  const filePath = nativeGeneratedImagePath(hanakoHome, sessionPath, { base64: normalized, mimeType });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(normalized, "base64"));
  }
  return serializeSessionFile(registerSessionFile({
    sessionPath,
    filePath,
    label: path.basename(filePath),
    origin: "native_image_generation",
    storageKind: "managed_cache",
  }));
}

export function sessionFileContentBlock(file) {
  if (!file?.filePath) return null;
  return {
    type: "file",
    ...(file.fileId || file.id ? { fileId: file.fileId || file.id } : {}),
    filePath: file.filePath,
    label: file.label || file.displayName || file.filename || path.basename(file.filePath),
    ext: file.ext || path.extname(file.filePath).slice(1),
    ...(file.mime ? { mime: file.mime } : {}),
    ...(file.kind ? { kind: file.kind } : {}),
    ...(file.size !== undefined ? { size: file.size } : {}),
    ...(file.storageKind ? { storageKind: file.storageKind } : {}),
    ...(file.status ? { status: file.status } : {}),
    ...(file.missingAt !== undefined ? { missingAt: file.missingAt } : {}),
  };
}

export function extractImageBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter(block => block?.type === "image" && (block.data || block.source?.data))
    .map(block => ({
      data: block.data || block.source.data,
      mimeType: block.mimeType || block.source?.media_type || "image/png",
    }))
    .filter(block => normalizeImageBase64Data(block.data));
}
