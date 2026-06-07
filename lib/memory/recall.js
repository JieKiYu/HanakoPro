import fs from "node:fs";
import path from "node:path";
import { sessionIdFromFilename } from "../session-jsonl.js";

const DEFAULT_MAX_ITEMS = 6;
const DEFAULT_MAX_CHARS = 1200;
const DIARY_LOOKBACK_FILES = 14;

const SOURCE_PRIORITY = {
  pinned: 24,
  facts: 20,
  longterm: 18,
  summary: 15,
  today: 12,
  week: 10,
  diary: 6,
};

const MEMORY_REFERENCE_RE = /(之前|以前|上次|前面|记得|记忆|提过|说过|继续|延续|remember|previous|before|last time|again|continue)/i;

export function resolveMemoryBehavior(config = {}) {
  const memory = config?.memory && typeof config.memory === "object" ? config.memory : {};
  const masterEnabled = memory.enabled !== false;
  return {
    enabled: masterEnabled,
    use: masterEnabled && memory.use !== false,
    generate: masterEnabled && memory.generate !== false,
  };
}

export function buildMemoryRecallText(items, {
  locale = "zh",
  maxChars = DEFAULT_MAX_CHARS,
} = {}) {
  const selected = [];
  let used = 0;
  for (const item of items || []) {
    const line = formatRecallLine(item, locale);
    if (!line) continue;
    if (used + line.length > maxChars && selected.length > 0) break;
    selected.push(line);
    used += line.length;
  }
  if (!selected.length) return "";

  const isZh = String(locale || "").startsWith("zh");
  const header = isZh
    ? [
        "## Hanako Recalled Memory",
        "",
        "这些记忆可能有助于当前请求。只在直接相关时使用；用户最新请求、当前文件、工具结果和明确指令高于记忆。若记忆无关或与事实冲突，忽略它。",
        "",
      ]
    : [
        "## Hanako Recalled Memory",
        "",
        "These memories may help with the current request. Use them only when directly relevant. The user's latest request, current files, tool results, and explicit instructions override memory. Ignore irrelevant or conflicting memories.",
        "",
      ];
  return [...header, ...selected].join("\n").trim();
}

export function buildMemoryRecallContext(options = {}) {
  const {
    agent,
    query,
    messages,
    cwd,
    sessionPath,
    maxItems = DEFAULT_MAX_ITEMS,
    maxChars = DEFAULT_MAX_CHARS,
  } = options;
  if (!agent) return { text: "", items: [] };

  const behavior = resolveMemoryBehavior(agent.config || agent._config || {});
  if (!behavior.use) return { text: "", items: [] };

  const queryText = buildRecallQuery({ query, messages, cwd });
  const candidates = collectMemoryCandidates({ agent, cwd, sessionPath });
  const scored = rankMemoryCandidates(candidates, queryText, { sessionPath });
  const items = diversifyMemoryItems(scored, maxItems);
  const text = buildMemoryRecallText(items, {
    locale: agent.config?.locale || agent._config?.locale || "zh",
    maxChars,
  });
  return { text, items };
}

export function injectMemoryRecallMessages(messages, recallText) {
  if (!recallText || !Array.isArray(messages)) return { messages, injected: 0 };
  const memoryMessage = {
    role: "system",
    content: [{ type: "text", text: recallText }],
  };
  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex < 0) return { messages: [memoryMessage, ...messages], injected: 1 };
  return {
    messages: [
      ...messages.slice(0, lastUserIndex),
      memoryMessage,
      ...messages.slice(lastUserIndex),
    ],
    injected: 1,
  };
}

export function collectMemoryCandidates({ agent, cwd, sessionPath } = {}) {
  const out = [];
  if (!agent?.agentDir) return out;
  const memoryDir = path.join(agent.agentDir, "memory");
  const now = Date.now();

  for (const item of readPinnedItems(path.join(agent.agentDir, "pinned.md"))) {
    out.push(makeCandidate("pinned", item, { label: "钉" }));
  }

  for (const { source, file, label } of [
    { source: "facts", file: "facts.md", label: "镜:事实" },
    { source: "longterm", file: "longterm.md", label: "镜:长期" },
    { source: "today", file: "today.md", label: "镜:今天" },
    { source: "week", file: "week.md", label: "镜:本周" },
  ]) {
    for (const item of readMarkdownMemoryItems(path.join(memoryDir, file))) {
      out.push(makeCandidate(source, item, { label, file: path.join(memoryDir, file) }));
    }
  }

  const currentSessionId = sessionPath ? sessionIdFromFilename(path.basename(sessionPath)) : "";
  const summaries = typeof agent.summaryManager?.getAllSummaries === "function"
    ? agent.summaryManager.getAllSummaries()
    : [];
  for (const summary of summaries) {
    if (!summary?.summary?.trim()) continue;
    if (currentSessionId && summary.session_id === currentSessionId) continue;
    out.push(makeCandidate("summary", summary.summary, {
      label: "络",
      id: summary.session_id,
      updatedAt: summary.updated_at || summary.created_at || "",
    }));
  }

  for (const diary of readRecentDiaryItems(cwd, DIARY_LOOKBACK_FILES)) {
    out.push(makeCandidate("diary", diary.text, {
      label: "笺",
      file: diary.file,
      updatedAt: diary.mtime ? new Date(diary.mtime).toISOString() : "",
      recencyMs: diary.mtime ? Math.max(0, now - diary.mtime) : null,
    }));
  }

  return out;
}

export function rankMemoryCandidates(candidates, queryText, { sessionPath } = {}) {
  const queryTokens = tokenize(queryText);
  const querySet = new Set(queryTokens);
  const hasReferenceTrigger = MEMORY_REFERENCE_RE.test(queryText || "");
  const cwdBase = basenameTerms(queryText);
  const seen = new Set();
  const ranked = [];

  for (const item of candidates || []) {
    const normalizedText = normalizeText(item.text);
    if (!normalizedText) continue;
    const dedupeKey = normalizedText.slice(0, 240);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const itemTokens = tokenize(item.text);
    const itemSet = new Set(itemTokens);
    let overlap = 0;
    for (const token of querySet) {
      if (itemSet.has(token)) overlap += token.length >= 4 ? 2 : 1;
      else if (token.length >= 4 && normalizedText.includes(token)) overlap += 1.5;
    }

    let score = overlap * 10 + (SOURCE_PRIORITY[item.source] || 0);
    if (hasReferenceTrigger && ["pinned", "facts", "longterm", "summary"].includes(item.source)) score += 12;
    if (hasReferenceTrigger && item.source === "diary") score += 4;
    for (const term of cwdBase) {
      if (term.length >= 3 && normalizedText.includes(term)) score += 8;
    }
    if (item.updatedAt) {
      const ageDays = (Date.now() - Date.parse(item.updatedAt)) / 86400000;
      if (Number.isFinite(ageDays)) score += Math.max(0, 8 - Math.min(8, ageDays));
    }

    if (overlap <= 0 && !hasReferenceTrigger && item.source !== "pinned") continue;
    if (overlap <= 0 && !hasReferenceTrigger && item.source === "pinned" && querySet.size > 2) continue;

    ranked.push({
      ...item,
      score,
      overlap,
      sessionPath,
    });
  }

  ranked.sort((a, b) => b.score - a.score || (SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0));
  return ranked;
}

function diversifyMemoryItems(items, maxItems) {
  const counts = new Map();
  const selected = [];
  for (const item of items || []) {
    const count = counts.get(item.source) || 0;
    const cap = item.source === "pinned" ? 3 : item.source === "summary" ? 3 : 2;
    if (count >= cap) continue;
    selected.push(item);
    counts.set(item.source, count + 1);
    if (selected.length >= maxItems) break;
  }
  return selected;
}

function makeCandidate(source, text, meta = {}) {
  return {
    source,
    label: meta.label || source,
    text: cleanMemoryText(text),
    id: meta.id || "",
    file: meta.file || "",
    updatedAt: meta.updatedAt || "",
  };
}

function formatRecallLine(item, locale) {
  const text = cleanMemoryText(item?.text || "");
  if (!text) return "";
  const isZh = String(locale || "").startsWith("zh");
  const label = item.label || item.source || (isZh ? "记忆" : "memory");
  const suffixParts = [];
  if (item.updatedAt) suffixParts.push(shortDate(item.updatedAt));
  if (item.id && item.source === "summary") suffixParts.push(item.id.slice(0, 8));
  const suffix = suffixParts.length ? ` (${suffixParts.join(", ")})` : "";
  return `- [${label}] ${truncate(text, 260)}${suffix}`;
}

function readPinnedItems(filePath) {
  const raw = readOptionalText(filePath);
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function readMarkdownMemoryItems(filePath) {
  const raw = readOptionalText(filePath);
  if (!raw.trim()) return [];
  const lines = raw.split(/\r?\n/);
  const items = [];
  let paragraph = [];
  const flush = () => {
    const text = paragraph.join(" ").trim();
    if (text) items.push(text);
    paragraph = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^#{1,6}\s+/.test(trimmed)) {
      flush();
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flush();
      items.push(bullet[1].trim());
    } else {
      paragraph.push(trimmed);
    }
  }
  flush();
  return items.filter(Boolean);
}

function readRecentDiaryItems(cwd, maxFiles) {
  const dir = resolveDiaryDir(cwd);
  if (!dir) return [];
  let files = [];
  try {
    files = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => {
        const file = path.join(dir, entry.name);
        let stat = null;
        try { stat = fs.statSync(file); } catch {}
        return { file, mtime: stat?.mtimeMs || 0 };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, maxFiles);
  } catch {
    return [];
  }

  return files
    .map(({ file, mtime }) => ({
      file,
      mtime,
      text: diaryExcerpt(readOptionalText(file), path.basename(file)),
    }))
    .filter((item) => item.text);
}

function diaryExcerpt(raw, fallbackTitle) {
  const text = raw
    .replace(/<mood>[\s\S]*?<\/mood>/gi, "")
    .replace(/^---[\s\S]*?^---/m, "")
    .trim();
  if (!text) return "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() || fallbackTitle;
  const body = lines
    .filter((line) => !line.startsWith("#") && !line.startsWith("---"))
    .slice(0, 8)
    .join(" ");
  return cleanMemoryText(`${title}: ${body}`);
}

function resolveDiaryDir(cwd) {
  if (!cwd) return "";
  const zhDir = path.join(cwd, "日记");
  try {
    if (fs.existsSync(zhDir)) return zhDir;
  } catch {}
  return path.join(cwd, "diary");
}

function buildRecallQuery({ query, messages, cwd }) {
  const parts = [];
  if (query) parts.push(query);
  const recentText = extractRecentUserText(messages, 3);
  if (recentText) parts.push(recentText);
  if (cwd) {
    parts.push(path.basename(cwd));
    parts.push(cwd);
  }
  return parts.join("\n");
}

function extractRecentUserText(messages, limit) {
  if (!Array.isArray(messages)) return "";
  const out = [];
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i--) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const text = extractMessageText(msg);
    if (text) out.unshift(text);
  }
  return out.join("\n");
}

function extractMessageText(msg) {
  if (typeof msg?.content === "string") return msg.content;
  if (Array.isArray(msg?.content)) {
    return msg.content
      .map((part) => typeof part === "string" ? part : part?.text || "")
      .filter(Boolean)
      .join("\n");
  }
  return msg?.text || "";
}

function findLastUserMessageIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = [];
  const words = normalized.match(/[a-z0-9_./-]{2,}/g) || [];
  tokens.push(...words);
  const cjkRuns = normalized.match(/[\p{Script=Han}]{2,}/gu) || [];
  for (const run of cjkRuns) {
    if (run.length <= 4) tokens.push(run);
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
    for (let i = 0; i < run.length - 2; i++) tokens.push(run.slice(i, i + 3));
  }
  return Array.from(new Set(tokens.filter((token) => token.length >= 2)));
}

function basenameTerms(text) {
  return Array.from(new Set(
    String(text || "")
      .split(/[\\/]/)
      .map((part) => normalizeText(part))
      .filter((part) => part.length >= 3),
  ));
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMemoryText(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  const cleaned = cleanMemoryText(text);
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function readOptionalText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}
