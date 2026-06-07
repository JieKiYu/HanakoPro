/**
 * known-models.js — 模型词典查询
 *
 * 加载 lib/known-models.json（provider → model 二级结构）
 * 和 lib/known-model-fallbacks.json（model → 通用参考值），
 * 提供 lookupKnown(provider, modelId) 查询接口。
 *
 * 惰性加载：首次调用 lookupKnown() 时才从磁盘读取并解析 JSON，
 * 避免 import 时阻塞模块加载链。
 */
import { readFileSync } from "fs";
import { fromRoot } from "./hana-root.js";

let _raw = null;
let _fallbacks = null;

const IMAGE_GENERATION_MODEL_PATTERNS = [
  /(^|[^a-z0-9])image([^a-z0-9]|$)/i,
  /seedream/i,
  /(^|[^a-z0-9])dall[-_ ]?e([^a-z0-9]|$)/i,
  /(^|[^a-z0-9])imagen([^a-z0-9]|$)/i,
  /(^|[^a-z0-9])flux([^a-z0-9]|$)/i,
];

function _ensureLoaded() {
  if (_raw) return;
  _raw = JSON.parse(readFileSync(fromRoot("lib", "known-models.json"), "utf-8"));
  _fallbacks = JSON.parse(readFileSync(fromRoot("lib", "known-model-fallbacks.json"), "utf-8"));
}

/**
 * 查词典：provider + modelId 二级查找，再查通用模型参考值。
 * 通用 fallback 是 best-effort baseline，不能从其他 provider 分区隐式借值。
 * @param {string} provider
 * @param {string} modelId
 * @returns {object|null}
 */
export function lookupKnown(provider, modelId) {
  if (typeof modelId !== "string" || modelId.length === 0) return null;
  _ensureLoaded();
  if (provider && _raw[provider]?.[modelId]) return _raw[provider][modelId];
  const bare = modelId.includes("/") ? modelId.split("/").pop() : null;
  if (bare && provider && _raw[provider]?.[bare]) return _raw[provider][bare];
  if (_fallbacks[modelId]) return _fallbacks[modelId];
  if (bare && _fallbacks[bare]) return _fallbacks[bare];
  return null;
}

function modelIdOf(modelEntry) {
  if (modelEntry && typeof modelEntry === "object") {
    return typeof modelEntry.id === "string" ? modelEntry.id : "";
  }
  return typeof modelEntry === "string" ? modelEntry : "";
}

function modelNamesOf(modelEntry, known = null) {
  const values = [modelIdOf(modelEntry)];
  if (modelEntry && typeof modelEntry === "object") {
    values.push(modelEntry.name, modelEntry.displayName, modelEntry.display_name);
  }
  if (known && typeof known === "object") {
    values.push(known.name, known.displayName, known.display_name);
  }
  return values.filter(value => typeof value === "string" && value.trim());
}

export function looksLikeImageGenerationModel(modelEntry, known = null) {
  return modelNamesOf(modelEntry, known).some(value =>
    IMAGE_GENERATION_MODEL_PATTERNS.some(pattern => pattern.test(value))
  );
}

export function inferKnownModelType(provider, modelEntry) {
  if (modelEntry && typeof modelEntry === "object" && typeof modelEntry.type === "string" && modelEntry.type.trim()) {
    return modelEntry.type.trim();
  }
  const id = modelIdOf(modelEntry);
  const known = lookupKnown(provider, id);
  if (typeof known?.type === "string" && known.type.trim()) return known.type.trim();
  return looksLikeImageGenerationModel(modelEntry, known) ? "image" : "chat";
}
