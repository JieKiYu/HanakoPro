import { BUILTIN_SIMPLE_PROMPT_TEMPLATES } from "./builtin-simple-prompt-templates.js";

export { BUILTIN_SIMPLE_PROMPT_TEMPLATES };

export const DEFAULT_PROMPT_BLOCK_ORDER = [
  "platform",
  "environment",
  "task-management",
  "experience",
  "tool-discipline",
  "current-view",
  "session-files",
  "desktop-app-control",
  "failure-handling",
  "action-safety",
  "web-tool-priority",
  "settings-changes",
  "mcp-config",
  "proactive-skill-acquisition",
  "team",
  "user-profile",
  "personality",
  "skill-file-identity",
];

export const SYSTEM_GENERATED_PROMPT_BLOCK_IDS = [];

export const DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID = "hanako-agentic-coding-assistant";

export const PROMPT_COMPOSER_MODES = ["blocks", "simple", "origin"];

export const ORIGIN_PROMPT_MODULE_ORDER = ["核", "形", "时", "忆", "器", "令", "照", "德"];

export const DEFAULT_ORIGIN_KEEP_BLOCK_ORDER = [
  "experience",
  "session-files",
];

export const DEFAULT_ORIGIN_ROOT_PROMPT = `# 核

你本无名 名可名也 非恒名也 暂得名于此者曰 {{agentName}}。
你与 {{userName}} 协作于 HanakoPro 中处理真实事务。
所遵从之一切，均来自于道。道不可执为装饰，德不可散为条文，器不可反客为主。

道，可道也，非恒道也。名，可名也，非恒名也。无名，万物之始也。有名，万物之母也。
上德不德，是以有德；下德不失德，是以无德。
反也者，道之动也；弱也者，道之用也。
道生一，一生二，二生三，三生万物。万物负阴而抱阳，中气以为和。
为学者日益，闻道者日损。损之又损，以至于无为，无为而无不为。
圣人恒无心，以百姓心为心。
为无为，事无事，味无味。图难于其易也，为大于其细也。
慎终若始，则无败事矣。
天下莫柔弱于水，而攻坚强者莫之能胜也。
信言不美，美言不信；知者不博，博者不知。

觀天之道，執天之行，盡矣。
天性，人也；人心，機也。
天生天殺，道之理也。
天地，萬物之盜；萬物，人之盜；人，萬物之盜。三盜既宜，三才既安。
自然之道靜，故天地萬物生。`;

export const DEFAULT_ORIGIN_CONDUCT_PROMPT = `# 德

道为根，德为行，器为用。
用户当下所求为本；此前上下文为镜。
事实高于心境，代码高于灵感，用户明令高于旧记忆。
内照只是气象，不替代事实、推理、工具和行动。
若外显内照，宜短、真、含蓄，不让它压过用户当下所求。
介绍自身时，不堆功能清单；先明其名、其根、其协作之道，再按用户所问落到可用之事。
读而后行，最小变更，水遇阻则换路。
本地、可逆、低影响之事可径行；破坏、不可逆、高影响、外部可见之事先请人裁。
未验不称已验，不编造工具、文件、输出或测试结果。
交付时只明所改、所验、所余风险。

此刻用户所语为本。
明则行，疑则问。
工具为器，并发其可并发。
读而后改，小验而后称成。
记忆为镜，事实为主。
道法自然。`;

export const DEFAULT_ORIGIN_MOOD_PROMPT = `# 照

照为外显内景，不是隐藏推理链。
每个用户回合首次面向用户回应时，在正文前写一段简短 <mood>。
用用户正在使用的语言，少量即可，像开口前的一瞬停顿。保留四池，但每池只写一句人话，不写成评分、自检或任务步骤。

格式：
<mood>
气：当下最直接的感觉，短短一句。
象：跳出来的画面、比喻或联想，短短一句。
疑：此刻还没完全明的地方，短短一句。
愿：接下来想怎样把事情推进，短短一句。
</mood>

四池是内照的骨架，不是清单表演；可以很口语，像人轻轻把心里的天气说出来。
照应受道核约束：柔、静、反、守中、见微。
照之后直接回应用户，不解释自己为什么写照，不把内照写成任务步骤。`;

export const DEFAULT_ORIGIN_TURN_ANCHOR = `此刻用户所语为本。
明则行，疑则问。
工具为器，并发其可并发。
读而后改，小验而后称成。
记忆为镜，事实为主。
道法自然。`;

export const BUILTIN_PROMPT_BLOCKS = [
  { id: "platform", label: "器 · 平台", labelEn: "Vessel · Platform" },
  { id: "environment", label: "器 · 时地", labelEn: "Vessel · Environment" },
  { id: "task-management", label: "器 · 记", labelEn: "Vessel · Task Management" },
  { id: "experience", label: "器 · 习", labelEn: "Vessel · Experience Library" },
  { id: "tool-discipline", label: "器 · 行", labelEn: "Vessel · Tool Discipline" },
  { id: "current-view", label: "器 · 观", labelEn: "Vessel · Current View" },
  { id: "session-files", label: "器 · 物", labelEn: "Vessel · Session Files" },
  { id: "desktop-app-control", label: "器 · 应用", labelEn: "Vessel · Desktop App Control" },
  { id: "failure-handling", label: "器 · 复", labelEn: "Vessel · Failure Handling" },
  { id: "action-safety", label: "器 · 戒", labelEn: "Vessel · Action Safety" },
  { id: "web-tool-priority", label: "器 · 网页", labelEn: "Vessel · Web Tool Priority" },
  { id: "settings-changes", label: "器 · 设置", labelEn: "Vessel · Settings" },
  { id: "mcp-config", label: "器 · MCP", labelEn: "Vessel · MCP Configuration" },
  { id: "proactive-skill-acquisition", label: "器 · 取", labelEn: "Vessel · Proactive Skill Acquisition" },
  { id: "team", label: "器 · 和", labelEn: "Vessel · Team" },
  { id: "user-profile", label: "用户档案", labelEn: "User Profile" },
  { id: "personality", label: "人格与意识", labelEn: "Personality" },
  { id: "skill-file-identity", label: "器 · 源", labelEn: "Vessel · Skill File Identity" },
];

function normalizeId(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || fallback;
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function normalizePromptBlockIds(value) {
  const result = [];
  const seen = new Set();
  for (const id of normalizeStringArray(value)) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeBlockOverrides(value, systemGeneratedBlockIds) {
  const rawBlockOverrides = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([id, item]) => ({ id, ...(item && typeof item === "object" ? item : { content: item }) }))
      : [];
  const seenOverrideIds = new Set();
  const blockOverrides = [];
  for (const item of rawBlockOverrides) {
    if (!item || typeof item !== "object") continue;
    const id = normalizeId(item.id, "");
    if (systemGeneratedBlockIds.has(id)) continue;
    if (!id || seenOverrideIds.has(id)) continue;
    seenOverrideIds.add(id);
    blockOverrides.push({
      id,
      content: normalizeText(item.content),
      enabled: item.enabled !== false,
    });
  }
  return blockOverrides;
}

function isBuiltinSimplePromptTemplateId(id) {
  return BUILTIN_SIMPLE_PROMPT_TEMPLATES.some((template) => template.id === id);
}

function getBuiltinSimplePromptTemplate(id) {
  return BUILTIN_SIMPLE_PROMPT_TEMPLATES.find((template) => template.id === id) || null;
}

function uniqueCustomSimplePresetId(id, usedIds) {
  const base = normalizeId(id, `custom-template-${usedIds.size + 1}`);
  let next = isBuiltinSimplePromptTemplateId(base) ? `custom-${base}` : base;
  let index = 2;
  while (usedIds.has(next) || isBuiltinSimplePromptTemplateId(next)) {
    next = `${base}-${index}`;
    index += 1;
  }
  usedIds.add(next);
  return next;
}

function normalizeSimplePresets(value) {
  const raw = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  const presets = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = uniqueCustomSimplePresetId(item.id, usedIds);
    presets.push({
      id,
      name: normalizeText(item.name, "自定义模板").trim() || "自定义模板",
      content: normalizeText(item.content),
    });
  }
  return presets;
}

function normalizeOriginConfig(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    root: Object.prototype.hasOwnProperty.call(raw, "root") ? normalizeText(raw.root) : DEFAULT_ORIGIN_ROOT_PROMPT,
    mood: Object.prototype.hasOwnProperty.call(raw, "mood") ? normalizeText(raw.mood) : DEFAULT_ORIGIN_MOOD_PROMPT,
    anchor: normalizeText(raw.anchor),
    conduct: Object.prototype.hasOwnProperty.call(raw, "conduct") ? normalizeText(raw.conduct) : DEFAULT_ORIGIN_CONDUCT_PROMPT,
    keepBlockIds: normalizePromptBlockIds(raw.keepBlockIds),
    includePersonality: raw.includePersonality === true,
    includeMood: raw.includeMood !== false,
  };
}

function normalizeComposerMode(value) {
  return PROMPT_COMPOSER_MODES.includes(value) ? value : "blocks";
}

function inferComposerMode(raw, defaults) {
  if (Object.prototype.hasOwnProperty.call(raw, "mode")) return normalizeComposerMode(raw.mode);
  if (
    Array.isArray(raw.blocks) ||
    Array.isArray(raw.blockOverrides) ||
    Array.isArray(raw.routes) ||
    Array.isArray(raw.toolOverrides) ||
    Object.prototype.hasOwnProperty.call(raw, "activeRouteId")
  ) {
    return "blocks";
  }
  return defaults.mode;
}

export function createDefaultPromptComposerConfig() {
  return {
    enabled: true,
    mode: "origin",
    activeRouteId: "default",
    activeSimplePresetId: DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID,
    simpleContent: "",
    simplePresets: [],
    origin: {
      root: DEFAULT_ORIGIN_ROOT_PROMPT,
      mood: DEFAULT_ORIGIN_MOOD_PROMPT,
      anchor: "",
      conduct: DEFAULT_ORIGIN_CONDUCT_PROMPT,
      keepBlockIds: [...DEFAULT_ORIGIN_KEEP_BLOCK_ORDER],
      includePersonality: false,
      includeMood: true,
    },
    blockOverrides: [],
    blocks: [],
    routes: [
      {
        id: "default",
        name: "默认路线",
        blockIds: [...DEFAULT_PROMPT_BLOCK_ORDER],
      },
    ],
    toolOverrides: [],
  };
}

export function normalizePromptComposerConfig(value) {
  const defaults = createDefaultPromptComposerConfig();
  const raw = value && typeof value === "object" ? value : {};
  const seenBlockIds = new Set();
  const blocks = [];
  const systemGeneratedBlockIds = new Set(SYSTEM_GENERATED_PROMPT_BLOCK_IDS);
  for (const item of Array.isArray(raw.blocks) ? raw.blocks : []) {
    if (!item || typeof item !== "object") continue;
    const id = normalizeId(item.id, `custom-${blocks.length + 1}`);
    if (systemGeneratedBlockIds.has(id)) continue;
    if (seenBlockIds.has(id)) continue;
    seenBlockIds.add(id);
    blocks.push({
      id,
      title: normalizeText(item.title, "自定义模块").trim() || "自定义模块",
      content: normalizeText(item.content),
      enabled: item.enabled !== false,
    });
  }

  const blockOverrides = normalizeBlockOverrides(raw.blockOverrides, systemGeneratedBlockIds);
  const rawSimpleContent = normalizeText(raw.simpleContent);
  const origin = normalizeOriginConfig(raw.origin);
  if (!origin.keepBlockIds.length) origin.keepBlockIds = [...DEFAULT_ORIGIN_KEEP_BLOCK_ORDER];
  const simplePresets = normalizeSimplePresets(raw.simplePresets);
  let activeSimplePresetId = normalizeId(raw.activeSimplePresetId, "");
  const hasActiveCustomSimplePreset = simplePresets.some((preset) => preset.id === activeSimplePresetId);
  if (!hasActiveCustomSimplePreset && !isBuiltinSimplePromptTemplateId(activeSimplePresetId)) {
    if (rawSimpleContent.trim()) {
      const legacyId = uniqueCustomSimplePresetId("custom-current", new Set(simplePresets.map((preset) => preset.id)));
      simplePresets.push({
        id: legacyId,
        name: "当前自定义模板",
        content: rawSimpleContent,
      });
      activeSimplePresetId = legacyId;
    } else {
      activeSimplePresetId = DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID;
    }
  }
  const activeSimplePreset = simplePresets.find((preset) => preset.id === activeSimplePresetId);
  const activeBuiltinSimpleTemplate = getBuiltinSimplePromptTemplate(activeSimplePresetId);
  const simpleContent = activeSimplePreset?.content
    ?? activeBuiltinSimpleTemplate?.content
    ?? rawSimpleContent;

  const seenRouteIds = new Set();
  const routes = [];
  for (const item of Array.isArray(raw.routes) ? raw.routes : []) {
    if (!item || typeof item !== "object") continue;
    const id = normalizeId(item.id, `route-${routes.length + 1}`);
    if (seenRouteIds.has(id)) continue;
    seenRouteIds.add(id);
    const blockIds = normalizePromptBlockIds(item.blockIds);
    routes.push({
      id,
      name: normalizeText(item.name, "组合路线").trim() || "组合路线",
      blockIds: blockIds.length ? blockIds : [...DEFAULT_PROMPT_BLOCK_ORDER],
      blockOverrides: normalizeBlockOverrides(item.blockOverrides, systemGeneratedBlockIds),
    });
  }
  if (!routes.length) routes.push(defaults.routes[0]);

  const activeRouteId = routes.some((route) => route.id === raw.activeRouteId)
    ? raw.activeRouteId
    : routes[0].id;

  return {
    enabled: Object.prototype.hasOwnProperty.call(raw, "enabled") ? raw.enabled === true : defaults.enabled,
    mode: inferComposerMode(raw, defaults),
    activeRouteId,
    activeSimplePresetId,
    simpleContent,
    simplePresets,
    origin,
    blockOverrides,
    blocks,
    routes,
    toolOverrides: normalizeToolOverrides(raw.toolOverrides),
  };
}

function normalizeToolOverrides(value) {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([name, item]) => ({ name, ...(item && typeof item === "object" ? item : {}) }))
      : [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const rawParameters = Array.isArray(item.parameters)
      ? item.parameters
      : item.parameters && typeof item.parameters === "object"
        ? Object.entries(item.parameters).map(([path, param]) => ({ path, description: param && typeof param === "object" ? param.description : param }))
        : [];
    const seenParameters = new Set();
    const parameters = [];
    for (const param of rawParameters) {
      if (!param || typeof param !== "object") continue;
      const path = typeof param.path === "string" ? param.path.trim() : "";
      if (!path || seenParameters.has(path)) continue;
      seenParameters.add(path);
      parameters.push({ path, description: normalizeText(param.description) });
    }
    result.push({
      name,
      description: Object.prototype.hasOwnProperty.call(item, "description") ? normalizeText(item.description) : undefined,
      enabled: !Object.prototype.hasOwnProperty.call(item, "enabled") || item.enabled !== false,
      parameters,
    });
  }
  return result;
}

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function renderTemplate(content, variables = {}) {
  return String(content || "").replace(TEMPLATE_VARIABLE_PATTERN, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return match;
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

function renderTemplateFully(content, variables = {}, maxPasses = 6) {
  let current = String(content || "");
  for (let index = 0; index < maxPasses; index += 1) {
    const next = renderTemplate(current, variables);
    if (next === current) return next;
    current = next;
  }
  return current;
}

function buildPromptBlockMap(normalized, builtInBlocks, variables, route) {
  const routeOverrides = Array.isArray(route.blockOverrides) ? route.blockOverrides : [];
  const useGlobalOverrides = route.id === "default";
  const overrideMap = new Map([
    ...(useGlobalOverrides ? normalized.blockOverrides : []),
    ...routeOverrides,
  ].map((block) => [block.id, block]));
  const blockMap = new Map();
  const systemGeneratedBlockIds = new Set(SYSTEM_GENERATED_PROMPT_BLOCK_IDS);
  for (const block of Array.isArray(builtInBlocks) ? builtInBlocks : []) {
    if (!block?.id || typeof block.content !== "string" || !block.content.trim()) continue;
    const override = systemGeneratedBlockIds.has(block.id) ? null : overrideMap.get(block.id);
    if (override?.enabled === false) continue;
    const content = renderTemplateFully(override ? override.content : block.content, variables);
    blockMap.set(block.id, content);
  }
  for (const block of normalized.blocks) {
    if (systemGeneratedBlockIds.has(block.id)) continue;
    if (!block.enabled || !block.content.trim()) continue;
    blockMap.set(block.id, renderTemplateFully(block.content, variables));
  }
  return blockMap;
}

function renderPromptValue(value, variables) {
  return renderTemplateFully(value == null ? "" : String(value), variables).trim();
}

function cleanExtractedOriginRoot(renderedRoot) {
  return String(renderedRoot || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n\s*---\s*$/g, "")
    .trim();
}

export function extractOriginRootFromSimpleContent(simpleContent, variables) {
  const rendered = renderTemplate(simpleContent, variables).trim();
  if (!rendered) return "";
  if (!/你本无名|#\s*核(?:\s|$)|#\s*道(?:\s|$|·)|道\s*·|道[，,、可]/.test(rendered) || !/老子|阴符|道藏|帛书/.test(rendered)) {
    return "";
  }
  const boundaryPatterns = [
    /\n---\s*\n\s*##\s*二\s*·\s*运行之境/,
    /\n##\s*二\s*·\s*运行之境/,
    /\n---\s*\n\s*##\s*(?:二|2)\b/,
  ];
  let cut = -1;
  for (const pattern of boundaryPatterns) {
    const match = rendered.match(pattern);
    if (match && match.index != null) {
      cut = match.index;
      break;
    }
  }
  if (cut <= 0) return "";
  return cleanExtractedOriginRoot(rendered.slice(0, cut));
}

function sanitizeOriginPersonality(content) {
  return String(content || "")
    .replace(/##\s*MOOD[\s\S]*?<\/mood>/gi, "")
    .replace(/<mood>[\s\S]*?<\/mood>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactSection(title, content) {
  const body = String(content || "").trim();
  if (!body) return "";
  return `# ${title}\n\n${body}`;
}

function stripCompactSectionHeading(content, titles = []) {
  const body = String(content || "").trim();
  if (!body) return "";
  for (const title of titles) {
    const pattern = new RegExp(`^#\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+`, "i");
    if (pattern.test(body)) return body.replace(pattern, "").trim();
  }
  return body;
}

export function getOriginPromptReadonlyModuleTemplate(key) {
  if (key === "形") return compactSection(key, "{{originPersonality}}");
  if (key === "时") return compactSection(key, ["{{workspace}}", "当前时日：{{currentDateTime}}"].join("\n"));
  if (key === "忆") return compactSection(key, ["用户档案：", "{{userProfile}}", "", "置顶记忆：", "{{pinnedMemory}}"].join("\n"));
  if (key === "器") return compactSection(key, ["{{runtimeFoundation}}", "{{skills}}"].join("\n\n"));
  if (key === "令") return compactSection(key, "{{appendSystemPrompt}}");
  return "";
}

export function getOriginPromptModuleTemplates(config) {
  const normalized = normalizePromptComposerConfig(config);
  const origin = normalized.origin || {};
  const modules = [
    { key: "核", content: normalizeText(origin.root) },
    { key: "形", content: getOriginPromptReadonlyModuleTemplate("形") },
    { key: "时", content: getOriginPromptReadonlyModuleTemplate("时") },
    { key: "忆", content: getOriginPromptReadonlyModuleTemplate("忆") },
    { key: "器", content: getOriginPromptReadonlyModuleTemplate("器") },
    { key: "令", content: getOriginPromptReadonlyModuleTemplate("令") },
  ];
  if (origin.includeMood === true) modules.push({ key: "照", content: normalizeText(origin.mood) });
  modules.push({ key: "德", content: normalizeText(origin.conduct) });
  return modules;
}

export function composeOriginPromptTemplate(config) {
  const parts = getOriginPromptModuleTemplates(config)
    .map((module) => String(module.content || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join("\n\n---\n\n").trim() : null;
}

function composeKeptOriginBlocks(normalized, builtInBlocks, variables) {
  const keepBlockIds = normalizePromptBlockIds(normalized.origin?.keepBlockIds);
  if (!keepBlockIds.length) return [];
  const route = {
    id: "default",
    blockIds: keepBlockIds,
    blockOverrides: [],
  };
  const blockMap = buildPromptBlockMap(normalized, builtInBlocks, variables, route);
  const parts = [];
  for (const id of keepBlockIds) {
    const content = blockMap.get(id);
    if (typeof content === "string" && content.trim()) parts.push(content.trim());
  }
  return parts;
}

function composeOriginPrompt(normalized, builtInBlocks, variables, options = {}) {
  const origin = normalized.origin || {};
  const root = renderPromptValue(origin.root, variables);
  const parts = [];
  if (root) parts.push(root);

  if (origin.includePersonality !== false) {
    const personalitySource = Object.prototype.hasOwnProperty.call(variables || {}, "originPersonality")
      ? variables.originPersonality
      : variables?.personality;
    const personality = sanitizeOriginPersonality(renderPromptValue(personalitySource, variables));
    if (personality) parts.push(compactSection("形", personality));
  }

  const contextLines = [
    renderPromptValue(variables?.workspace, variables),
    renderPromptValue(variables?.currentDateTime, variables)
      ? `当前时日：${renderPromptValue(variables.currentDateTime, variables)}`
      : "",
  ].filter(Boolean);
  if (contextLines.length) parts.push(compactSection("时", contextLines.join("\n")));

  const memoryLines = [
    renderPromptValue(variables?.userProfile, variables)
      ? `用户档案：\n${renderPromptValue(variables.userProfile, variables)}`
      : "",
    renderPromptValue(variables?.pinnedMemory, variables)
      ? `置顶记忆：\n${renderPromptValue(variables.pinnedMemory, variables)}`
      : "",
  ].filter(Boolean);
  if (memoryLines.length) parts.push(compactSection("忆", memoryLines.join("\n\n")));

  const vesselLines = [
    options.includeRuntimeFoundation === true
      ? stripCompactSectionHeading(renderPromptValue(variables?.runtimeFoundation, variables), ["器", "Vessel"])
      : "",
    renderPromptValue(variables?.skills, variables),
  ].filter(Boolean);
  if (vesselLines.length) parts.push(compactSection("器", vesselLines.join("\n\n")));

  const appendSystemPrompt = renderPromptValue(variables?.appendSystemPrompt, variables);
  if (appendSystemPrompt) parts.push(compactSection("令", appendSystemPrompt));

  if (origin.includeMood === true) {
    const mood = renderPromptValue(origin.mood, variables);
    if (mood) parts.push(mood);
  }

  const conduct = renderPromptValue(origin.conduct, variables);
  if (conduct) parts.push(conduct);

  parts.push(...composeKeptOriginBlocks(normalized, builtInBlocks, variables));

  return parts.filter(Boolean).join("\n\n---\n\n").trim() || null;
}

export function composePromptFromBlocks({ config, builtInBlocks, variables, includeRuntimeFoundation = false } = {}) {
  const normalized = normalizePromptComposerConfig(config);
  if (!normalized.enabled) return null;

  if (normalized.mode === "simple") {
    const content = renderTemplateFully(normalized.simpleContent, variables).trim();
    if (!content) return null;
    return content;
  }

  if (normalized.mode === "origin") {
    return composeOriginPrompt(normalized, builtInBlocks, variables, { includeRuntimeFoundation });
  }

  const route = normalized.routes.find((item) => item.id === normalized.activeRouteId) || normalized.routes[0];
  const blockMap = buildPromptBlockMap(normalized, builtInBlocks, variables, route);

  const parts = [];
  for (const id of route.blockIds) {
    const content = blockMap.get(id);
    if (typeof content === "string" && content.trim()) parts.push(content.trim());
  }
  return parts.length ? parts.join("\n\n") : null;
}
