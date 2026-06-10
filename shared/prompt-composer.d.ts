export type PromptComposerBlock = {
  id: string;
  title: string;
  content: string;
  enabled?: boolean;
};

export type PromptComposerRoute = {
  id: string;
  name: string;
  blockIds: string[];
  blockOverrides?: PromptComposerBlockOverride[];
};

export type PromptComposerBlockOverride = {
  id: string;
  content: string;
  enabled?: boolean;
};

export type PromptComposerToolParameterOverride = {
  path: string;
  description: string;
};

export type PromptComposerToolOverride = {
  name: string;
  description?: string;
  enabled?: boolean;
  parameters: PromptComposerToolParameterOverride[];
};

export type PromptSimplePreset = {
  id: string;
  name: string;
  content: string;
};

export type PromptComposerOriginConfig = {
  root: string;
  mood: string;
  anchor: string;
  conduct: string;
  keepBlockIds: string[];
  includePersonality: boolean;
  includeMood: boolean;
};

export type BuiltinSimplePromptTemplate = {
  id: string;
  name: string;
  description: string;
  content: string;
};

export type PromptComposerConfig = {
  enabled: boolean;
  mode: "blocks" | "simple" | "origin";
  activeRouteId: string;
  activeSimplePresetId: string;
  simpleContent: string;
  simplePresets: PromptSimplePreset[];
  origin: PromptComposerOriginConfig;
  blockOverrides: PromptComposerBlockOverride[];
  blocks: PromptComposerBlock[];
  routes: PromptComposerRoute[];
  toolOverrides: PromptComposerToolOverride[];
};

export type BuiltinPromptBlockMeta = {
  id: string;
  label: string;
  labelEn: string;
};

export const DEFAULT_PROMPT_BLOCK_ORDER: string[];
export const SYSTEM_GENERATED_PROMPT_BLOCK_IDS: string[];
export const DEFAULT_SIMPLE_PROMPT_TEMPLATE_ID: string;
export const DEFAULT_ORIGIN_KEEP_BLOCK_ORDER: string[];
export const ORIGIN_PROMPT_MODULE_ORDER: string[];
export const DEFAULT_ORIGIN_ROOT_PROMPT: string;
export const DEFAULT_ORIGIN_CONDUCT_PROMPT: string;
export const DEFAULT_ORIGIN_MOOD_PROMPT: string;
export const DEFAULT_ORIGIN_TURN_ANCHOR: string;
export const BUILTIN_SIMPLE_PROMPT_TEMPLATES: BuiltinSimplePromptTemplate[];
export const PROMPT_COMPOSER_MODES: Array<"blocks" | "simple" | "origin">;
export const BUILTIN_PROMPT_BLOCKS: BuiltinPromptBlockMeta[];
export function createDefaultPromptComposerConfig(): PromptComposerConfig;
export function normalizePromptComposerConfig(value: unknown): PromptComposerConfig;
export function extractOriginRootFromSimpleContent(simpleContent: string, variables?: Record<string, unknown>): string;
export function getOriginPromptReadonlyModuleTemplate(key: string): string;
export function getOriginPromptModuleTemplates(config?: unknown): Array<{ key: string; content: string }>;
export function composeOriginPromptTemplate(config?: unknown): string | null;
export function composePromptFromBlocks(args?: {
  config?: unknown;
  builtInBlocks?: Array<{ id: string; content: string }>;
  variables?: Record<string, unknown>;
  includeRuntimeFoundation?: boolean;
}): string | null;
