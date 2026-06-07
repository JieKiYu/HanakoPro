/**
 * lib/llm/provider-client.js — Provider 认证 header 和连通性探测 URL 构造
 *
 * callProviderText 已迁移到 core/llm-client.js（走 Pi SDK），
 * 本文件只保留 test/health 路由需要的辅助函数。
 */

import { t } from "../../server/i18n.js";

const LOCAL_PROXY_FALLBACK = "http://127.0.0.1:7892";

function errorCode(err) {
  return err?.cause?.code || err?.code || "";
}

function errorMessage(err) {
  return err?.message || err?.cause?.message || String(err);
}

export function isNetworkFetchError(err) {
  const code = errorCode(err);
  if (code) {
    return [
      "ABORT_ERR",
      "ECONNRESET",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(code);
  }
  return /aborted|connect|dns|fetch failed|network|socket|timeout/i.test(errorMessage(err));
}

export function describeFetchError(err) {
  const code = errorCode(err);
  const message = errorMessage(err);
  return code && !message.includes(code) ? `${code}: ${message}` : message;
}

function normalizeProxyUrl(proxy) {
  const raw = String(proxy || "").trim();
  if (!raw) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function proxyCandidatesFromEnv(env = process.env) {
  return [
    env.HTTPS_PROXY,
    env.https_proxy,
    env.HTTP_PROXY,
    env.http_proxy,
    env.ALL_PROXY,
    env.all_proxy,
    LOCAL_PROXY_FALLBACK,
  ].map(normalizeProxyUrl).filter(Boolean);
}

function shouldBypassProxy(url, env = process.env) {
  const noProxy = env.NO_PROXY || env.no_proxy || "";
  if (!noProxy.trim()) return false;
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return noProxy.split(",").map(s => s.trim().toLowerCase()).some(rule => {
    if (!rule) return false;
    if (rule === "*") return true;
    if (rule.startsWith(".")) return hostname.endsWith(rule);
    return hostname === rule || hostname.endsWith(`.${rule}`);
  });
}

async function proxyAgent(proxyUrl) {
  const { ProxyAgent } = await import("undici");
  return new ProxyAgent(proxyUrl);
}

function fetchOptionsForAttempt(init, timeoutMs, dispatcher) {
  const opts = { ...init };
  if (timeoutMs) opts.signal = AbortSignal.timeout(timeoutMs);
  if (dispatcher) opts.dispatcher = dispatcher;
  return opts;
}

export async function fetchProviderUrl(url, init = {}, { timeoutMs } = {}) {
  try {
    return await fetch(url, fetchOptionsForAttempt(init, timeoutMs));
  } catch (err) {
    if (!isNetworkFetchError(err) || shouldBypassProxy(url)) throw err;
    let lastErr = err;
    const seen = new Set();
    for (const proxy of proxyCandidatesFromEnv()) {
      if (seen.has(proxy)) continue;
      seen.add(proxy);
      try {
        return await fetch(url, fetchOptionsForAttempt(init, timeoutMs, await proxyAgent(proxy)));
      } catch (proxyErr) {
        lastErr = proxyErr;
      }
    }
    throw lastErr;
  }
}

export async function readProviderResponseError(res) {
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  const fallback = `HTTP ${res.status}: ${res.statusText || "Provider request failed"}`;
  if (!body) return fallback;
  try {
    const data = JSON.parse(body);
    const error = data?.error || data;
    const message = error?.message_cn || error?.message || data?.message_cn || data?.message;
    const code = error?.err_code ?? error?.code ?? data?.err_code ?? data?.code;
    if (message && code !== undefined) return `${message} (code: ${code})`;
    if (message) return message;
  } catch {
    // fall through to compact text body
  }
  const compact = body.replace(/\s+/g, " ").trim();
  return compact ? `${fallback}: ${compact.slice(0, 300)}` : fallback;
}

/**
 * 构建 provider 认证 header
 * 被 /api/providers/test 和 /api/models/health 路由使用
 */
export function buildProviderAuthHeaders(api, apiKey, opts = {}) {
  const allowMissingApiKey = opts.allowMissingApiKey === true;
  if (!api) {
    throw new Error(t("error.missingApiProtocol"));
  }
  if (!apiKey && !allowMissingApiKey) {
    throw new Error(t("error.missingApiKey"));
  }

  if (api === "anthropic-messages") {
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (apiKey) headers["x-api-key"] = apiKey;
    return headers;
  }

  if (api === "openai-completions" || api === "openai-codex-responses" || api === "openai-responses") {
    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    return headers;
  }

  if (api === "google-generative-ai") {
    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["x-goog-api-key"] = apiKey;
    return headers;
  }

  throw new Error(t("error.unsupportedApiProtocol", { api }));
}

/**
 * 构建连通性探测 URL（统一 test/health 两条路由的 URL 逻辑）
 *
 * Anthropic 协议：POST baseUrl/v1/messages（和 Pi SDK Anthropic provider 一致）
 * OpenAI 兼容协议：GET normalizedBase/models
 * Google native 协议：GET baseUrl/models
 *
 * @param {string} baseUrl
 * @param {string} api
 * @returns {{ url: string, method: string }}
 */
export function buildProbeUrl(baseUrl, api) {
  const base = normalizedOpenAIBaseUrl(baseUrl, api).replace(/\/+$/, "");
  if (api === "anthropic-messages") {
    return { url: `${base}/v1/messages`, method: "POST" };
  }
  return { url: `${base}/models`, method: "GET" };
}

export function isOpenAICompatibleApi(api) {
  return api === "openai-completions" || api === "openai-responses" || api === "openai-codex-responses";
}

export function normalizedOpenAIBaseUrl(baseUrl, api) {
  const raw = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!raw || !isOpenAICompatibleApi(api)) return raw;
  if (/\/v\d+(?:\/(?:chat\/completions|responses|completions|embeddings))?$/i.test(raw)) {
    return raw.replace(/\/(?:chat\/completions|responses|completions|embeddings)$/i, "");
  }
  return `${raw}/v1`;
}

/**
 * 探测 provider 连通性（统一 health check + test 的唯一实现）
 *
 * 判断标准：排除 401/403（认证失败），其余状态码都视为连通。
 * Codex Responses API 因 Cloudflare 反爬无法探测，直接跳过返回 ok。
 *
 * @param {{ baseUrl: string, api: string, apiKey: string, modelId?: string }} params
 * @returns {Promise<{ ok: boolean, status: number, skipped?: string, error?: string }>}
 */
export async function probeProvider({ baseUrl, api, apiKey, modelId }) {
  if (api === "openai-codex-responses") {
    return { ok: true, status: 0, skipped: t("error.codexNoHealthCheck") };
  }

  const probe = buildProbeUrl(baseUrl, api);

  // 无 apiKey 时跳过认证 header（支持 ollama 等本地无认证 provider）
  const headers = (api && apiKey)
    ? buildProviderAuthHeaders(api, apiKey)
    : { "Content-Type": "application/json" };

  if (api === "anthropic-messages") {
    const res = await fetchProviderUrl(probe.url, {
      method: probe.method,
      headers,
      body: JSON.stringify({
        model: modelId || "test",
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    }, { timeoutMs: 10000 });
    const authOk = res.status !== 401 && res.status !== 403;
    return authOk
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, error: await readProviderResponseError(res) };
  }

  const res = await fetchProviderUrl(probe.url, { headers }, { timeoutMs: 10000 });
  const authOk = res.status !== 401 && res.status !== 403;
  return authOk
    ? { ok: true, status: res.status }
    : { ok: false, status: res.status, error: await readProviderResponseError(res) };
}
