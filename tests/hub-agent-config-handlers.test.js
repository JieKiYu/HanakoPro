import { describe, it, expect, vi } from "vitest";
import { Hub } from "../hub/index.js";

function createEngine(overrides = {}) {
  const agents = new Map([
    [
      "agent-1",
      {
        id: "agent-1",
        config: { mcp: { connectors: { github: { enabled: true } } } },
        setDmSentHandler: vi.fn(),
      },
    ],
  ]);
  return {
    agents,
    agentsDir: "/agents",
    channelsDir: null,
    providerRegistry: {
      getCredentials: vi.fn(() => ({})),
      getModelsByType: vi.fn(() => []),
      getAllModelsByType: vi.fn(() => []),
    },
    setHubCallbacks: vi.fn(),
    setEventBus: vi.fn(),
    getAgent: vi.fn((agentId) => agents.get(agentId) || null),
    updateConfig: vi.fn(async (partial, { agentId }) => {
      const agent = agents.get(agentId);
      if (agent) agent.config = { ...agent.config, ...partial };
    }),
    listAgents: vi.fn(() => []),
    listSessions: vi.fn(async () => []),
    isSessionStreaming: vi.fn(() => false),
    promptSession: vi.fn(async () => {}),
    abortSession: vi.fn(async () => true),
    dispose: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("Hub agent config bus handlers", () => {
  it("reads agent config through the engine public getAgent contract", async () => {
    const engine = createEngine();
    const hub = new Hub({ engine });

    const result = await hub.eventBus.request("agent:config", { agentId: "agent-1" });

    expect(engine.getAgent).toHaveBeenCalledWith("agent-1");
    expect(result.config.mcp.connectors.github.enabled).toBe(true);
  });

  it("updates agent config and returns the refreshed agent config", async () => {
    const engine = createEngine();
    const hub = new Hub({ engine });

    const result = await hub.eventBus.request("agent:update-config", {
      agentId: "agent-1",
      partial: { mcp: { connectors: { github: { enabled: false } } } },
    });

    expect(engine.updateConfig).toHaveBeenCalledWith(
      { mcp: { connectors: { github: { enabled: false } } } },
      { agentId: "agent-1" },
    );
    expect(result.config.mcp.connectors.github.enabled).toBe(false);
  });

  it("returns explicit errors for missing or unavailable agent lookup", async () => {
    const hub = new Hub({ engine: createEngine() });
    const missingAgentId = await hub.eventBus.request("agent:config", {});
    const missingAgent = await hub.eventBus.request("agent:config", { agentId: "missing" });

    expect(missingAgentId.error).toBe("agent_id_required");
    expect(missingAgent.error).toBe("not_found");

    const noLookupEngine = createEngine({ getAgent: undefined });
    const noLookupHub = new Hub({ engine: noLookupEngine });
    const noLookup = await noLookupHub.eventBus.request("agent:config", { agentId: "agent-1" });

    expect(noLookup.error).toBe("agent_lookup_unavailable");
  });
});

describe("Hub media provider bus handlers", () => {
  it("returns cached image-like discovered models as addable media models", async () => {
    const providerRegistry = {
      getCredentials: vi.fn(() => ({})),
      getModelsByType: vi.fn(() => []),
      getAllModelsByType: vi.fn(() => []),
      getMediaProviders: vi.fn(() => [
        {
          providerId: "volcengine",
          displayName: "Volcengine",
          authType: "api-key",
          source: { kind: "user" },
          runtime: null,
          credentialLanes: [{ id: "volcengine", providerId: "volcengine" }],
          models: [{ id: "existing-image", displayName: "Existing Image", protocolId: "openai-image" }],
        },
      ]),
      getMediaProviderCredentialStatus: vi.fn((providerId) => ({
        hasCredentials: true,
        unavailableReason: null,
        activeLaneId: providerId,
        activeProviderId: providerId,
        lanes: [{ id: providerId, providerId }],
      })),
      getMediaCredentialLanes: vi.fn((providerId) => [{ id: providerId, providerId }]),
      getAll: vi.fn(() => new Map([
        ["volcengine", { id: "volcengine", displayName: "Volcengine", authType: "api-key", source: { kind: "user" } }],
        ["seed-only", { id: "seed-only", displayName: "Seed Only", authType: "api-key", source: { kind: "user" } }],
      ])),
    };
    const engine = createEngine({
      providerRegistry,
      getCachedModelsForProvider: vi.fn((providerId) => {
        if (providerId === "volcengine") {
          return [
            { id: "existing-image", name: "Existing Image" },
            { id: "doubao-seedream-4-0-250828", name: "Seedream 4.0" },
            { id: "deepseek-chat", name: "DeepSeek Chat" },
          ];
        }
        if (providerId === "seed-only") {
          return [
            { id: "seedream-5", name: "Seedream 5" },
            { id: "chat-model", name: "Chat Model" },
          ];
        }
        return [];
      }),
    });
    const hub = new Hub({ engine });

    const result = await hub.eventBus.request("provider:media-providers", { capability: "image_generation" });

    expect(result.providers.volcengine.models).toEqual([
      expect.objectContaining({ id: "existing-image", name: "Existing Image" }),
    ]);
    expect(result.providers.volcengine.availableModels).toEqual([
      { id: "doubao-seedream-4-0-250828", name: "Seedream 4.0", displayName: "Seedream 4.0" },
    ]);
    expect(result.providers["seed-only"]).toMatchObject({
      providerId: "seed-only",
      displayName: "Seed Only",
      models: [],
      availableModels: [
        { id: "seedream-5", name: "Seedream 5", displayName: "Seedream 5" },
      ],
    });
  });
});
