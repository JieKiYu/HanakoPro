import { describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-coding-agent", async () => ({
  createAgentSession: vi.fn(async opts => ({ session: { opts }, modelFallbackMessage: null })),
  SessionManager: { create: vi.fn(), open: vi.fn() },
  SettingsManager: { inMemory: vi.fn() },
  createReadTool: vi.fn(),
  createWriteTool: vi.fn(),
  createEditTool: vi.fn(),
  createBashTool: vi.fn(),
  createGrepTool: vi.fn(),
  createFindTool: vi.fn(),
  createLsTool: vi.fn(),
  DefaultResourceLoader: class {},
  formatSkillsForPrompt: vi.fn(),
  getLastAssistantUsage: vi.fn(),
  AuthStorage: class {},
  estimateTokens: vi.fn(),
  findCutPoint: vi.fn(),
  generateSummary: vi.fn(),
  serializeConversation: vi.fn(),
  shouldCompact: vi.fn(),
  parseSessionEntries: vi.fn(),
  buildSessionContext: vi.fn(),
  ModelRegistry: { create: vi.fn() },
}));

vi.mock("@mariozechner/pi-ai", async () => ({
  StringEnum: vi.fn(values => values),
  AssistantMessageEventStream: class {},
}));

vi.mock("@mariozechner/pi-ai/oauth", async () => ({
  registerOAuthProvider: vi.fn(),
}));

vi.mock("../lib/pi-sdk/session-options.js", async () => ({
  PI_BUILTIN_TOOL_NAMES: Object.freeze(["read", "write", "edit", "bash", "grep", "find", "ls"]),
  normalizeCreateAgentSessionOptions: vi.fn(opts => ({
    ...opts,
    normalizedByAdapter: true,
  })),
}));

describe("Pi SDK createAgentSession adapter", () => {
  it("normalizes options before calling the raw SDK", async () => {
    const sdk = await import("@mariozechner/pi-coding-agent");
    const adapter = await import("../lib/pi-sdk/index.js");
    const sessionOptions = {
      cwd: "/tmp/project",
      tools: [{ name: "read", execute: vi.fn() }],
      customTools: [{ name: "web_search", execute: vi.fn() }],
    };

    await adapter.createAgentSession(sessionOptions);

    expect(adapter.PI_BUILTIN_TOOL_NAMES).toEqual(["read", "write", "edit", "bash", "grep", "find", "ls"]);
    expect(sdk.createAgentSession).toHaveBeenCalledWith({
      ...sessionOptions,
      normalizedByAdapter: true,
    });
  });

  it("uses the resource loader agentDir as the SDK agentDir when omitted", async () => {
    const sdk = await import("@mariozechner/pi-coding-agent");
    const adapter = await import("../lib/pi-sdk/index.js");
    const resourceLoader = { agentDir: "/hana-home/.pi/agent" };

    await adapter.createAgentSession({
      cwd: "/tmp/project",
      resourceLoader,
    });

    expect(sdk.createAgentSession).toHaveBeenLastCalledWith({
      cwd: "/tmp/project",
      resourceLoader,
      agentDir: "/hana-home/.pi/agent",
      normalizedByAdapter: true,
    });
  });

  it("applies Acui OpenAI SDK fingerprint header overrides through the registry adapter", async () => {
    const sdk = await import("@mariozechner/pi-coding-agent");
    const adapter = await import("../lib/pi-sdk/index.js");
    const registry = {
      getApiKeyAndHeaders: vi.fn(async () => ({
        ok: true,
        apiKey: "sk-test",
        headers: { "X-Custom": "kept" },
      })),
    };
    const model = {
      id: "gpt-5.5",
      provider: "acui",
      api: "openai-responses",
      baseUrl: "https://api.acui.shop/v1",
    };

    await adapter.createAgentSession({
      cwd: "/tmp/project",
      modelRegistry: registry,
    });

    const passedRegistry = sdk.createAgentSession.mock.calls.at(-1)[0].modelRegistry;
    const auth = await passedRegistry.getApiKeyAndHeaders(model);
    expect(auth.headers).toMatchObject({
      "X-Custom": "kept",
      "User-Agent": null,
      "X-Stainless-Lang": null,
      "X-Stainless-Package-Version": null,
      "X-Stainless-OS": null,
      "X-Stainless-Arch": null,
      "X-Stainless-Runtime": null,
      "X-Stainless-Runtime-Version": null,
      "X-Stainless-Retry-Count": null,
      "X-Stainless-Timeout": null,
      "X-Stainless-Helper-Method": null,
      "X-Stainless-Poll-Helper": null,
      "X-Stainless-Custom-Poll-Interval": null,
      "OpenAI-Organization": null,
      "OpenAI-Project": null,
      "OpenAI-Beta": null,
    });
  });

  it("does not apply Acui header overrides to non-Acui models", async () => {
    const sdk = await import("@mariozechner/pi-coding-agent");
    const adapter = await import("../lib/pi-sdk/index.js");
    const registry = {
      getApiKeyAndHeaders: vi.fn(async () => ({
        ok: true,
        apiKey: "sk-test",
        headers: { "X-Custom": "kept" },
      })),
    };

    await adapter.createAgentSession({
      cwd: "/tmp/project",
      modelRegistry: registry,
    });

    const passedRegistry = sdk.createAgentSession.mock.calls.at(-1)[0].modelRegistry;
    const auth = await passedRegistry.getApiKeyAndHeaders({
      id: "gpt-4o",
      provider: "openai",
      api: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
    });
    expect(auth.headers).toEqual({ "X-Custom": "kept" });
  });
});
