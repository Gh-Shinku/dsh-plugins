import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Context, Service } from "@deepseek-ai/cordis";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import LlmRuntime, { createUserMessage, ToolCallId } from "@deepseek-ai/dsh-llm";
import McpResources from "@deepseek-ai/dsh-mcp-resources";
import { type PtcRunRequest, type PtcRunResult, type PtcRunSpec, PtcRuntime } from "@deepseek-ai/dsh-ptc-runtime";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import SessionProjections from "@deepseek-ai/dsh-session-projection";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { defineContentToolFixture } from "@deepseek-ai/dsh-tools";
import { afterEach, expect, it } from "vitest";
import type { ProfileDocument } from "../src/contracts.ts";
import { McpManager } from "../src/manager.ts";

const contexts: Context[] = [];
afterEach(async () => {
  await Promise.all(contexts.splice(0).map((ctx) => ctx.fiber.dispose()));
});

/** Only settings persistence is substituted here; agent scopes, MCP transport and tool execution are native. */
class SettingsFixture extends Service {
  constructor(ctx: Context) {
    super(ctx, "settings");
  }
  configure(): () => void {
    return () => {};
  }
}

async function setup(document: ProfileDocument = { profiles: [], defaultProfileId: "" }, mountManager = true) {
  const ctx = new Context();
  contexts.push(ctx);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SessionProjections);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(`${process.cwd()}/`).href });
  await ctx.plugin(SettingsFixture);
  await ctx.loader.root.update(
    ["a", "b"].map((id) => ({
      id,
      name: "@deepseek-ai/dsh-mcp-client",
      config: {
        serverName: id,
        transport: "stdio",
        command: process.execPath,
        args: [resolve("packages/dsh-mcp-manager/test/fixtures/server.mjs"), id],
        failOnStartupError: true,
      },
    })),
  );
  await ctx.loader.await();
  expect(ctx.tools.schemas().map((s) => s.name)).toContain("mcp__a__echo");
  if (mountManager) await mount(ctx, document);
  return ctx;
}

async function mount(ctx: Context, document: ProfileDocument = { profiles: [], defaultProfileId: "" }) {
  await ctx.plugin({
    inject: McpManager.inject,
    apply(inner: Context) {
      new McpManager(inner, { templates: { get: () => document } });
    },
  });
}

const choice = (servers: string[]) => ({ version: 1 as const, profileId: "", profileName: "", servers });
const call = (ctx: Context, agent: ReturnType<Context["agents"]["list"]>[number], name: string, args: object = {}) =>
  ctx.tools.execute({
    callId: ToolCallId(crypto.randomUUID()),
    name,
    arguments: args,
    agent,
    signal: new AbortController().signal,
  });

it("isolates concurrent sessions through native MCP discovery, prompt assembly and tool execution", async () => {
  const ctx = await setup();
  const a = await ctx.agents.create({ sessionId: SessionId("session-a") });
  const b = await ctx.agents.create({ sessionId: SessionId("session-b") });
  ctx.shinkuMcpManager.select(a.agent.id, choice(["a"]));
  ctx.shinkuMcpManager.select(b.agent.id, choice(["b"]));
  expect(ctx.tools.schemas(a.agent).map((t) => t.name)).toEqual(["mcp__a__echo"]);
  expect(ctx.tools.schemas(b.agent).map((t) => t.name)).toEqual(["mcp__b__echo"]);
  const prompt = await ctx.systemPrompt.assemble({ scope: a.agent });
  expect(prompt.sections.some((s) => s.text.includes("Only a instructions"))).toBe(true);
  expect(prompt.sections.some((s) => s.text.includes("Only b instructions"))).toBe(false);
  expect((await call(ctx, a.agent, "mcp__a__echo", { text: "hello" })).isError).toBe(false);
  expect((await call(ctx, a.agent, "mcp__b__echo")).isError).toBe(true);
  expect((await call(ctx, b.agent, "mcp__a__echo")).isError).toBe(true);
});

it("keeps session snapshots independent of templates and inherits the snapshot into a fork seed", async () => {
  const document = { profiles: [{ id: "dev", name: "Development", servers: ["a"] }], defaultProfileId: "dev" };
  const ctx = await setup(document);
  const first = await ctx.agents.create({ sessionId: SessionId("first") });
  document.profiles[0]?.servers.push("b");
  expect(ctx.shinkuMcpManager.selection(first.agent.id).selection.servers).toEqual(["a"]);
  const restored = await ctx.agents.create({
    sessionId: SessionId("restored"),
    seed: first.agent.session.snapshotEvents(),
  });
  expect(ctx.shinkuMcpManager.selection(restored.agent.id).selection.servers).toEqual(["a"]);
  const later = await ctx.agents.create({ sessionId: SessionId("later") });
  expect(ctx.shinkuMcpManager.selection(later.agent.id).selection.servers).toEqual(["a", "b"]);
});

it("allows MCP changes after a turn starts and refreshes declarations, guards and persisted snapshots", async () => {
  const ctx = await setup();
  const handle = await ctx.agents.create({ sessionId: SessionId("chatting") });
  const other = await ctx.agents.create({ sessionId: SessionId("other") });
  handle.agent.session.append("turn/start", { turn: 1 });
  ctx.shinkuMcpManager.select(handle.agent.id, choice(["a"]));
  expect(ctx.shinkuMcpManager.selection(handle.agent.id).locked).toBe(false);
  ctx.tools.register(
    defineContentToolFixture({ name: "mcp__b__new", description: "new", parameters: {}, execute: async () => [] }),
  );
  expect(ctx.tools.schemas(handle.agent).some((tool) => tool.name === "mcp__b__new")).toBe(false);
  ctx.shinkuMcpManager.select(handle.agent.id, choice(["b"]));
  expect(ctx.tools.schemas(handle.agent).map((tool) => tool.name)).toContain("mcp__b__new");
  expect((await call(ctx, handle.agent, "mcp__a__echo")).isError).toBe(true);
  expect((await call(ctx, handle.agent, "mcp__b__echo")).isError).toBe(false);
  expect(ctx.shinkuMcpManager.selection(other.agent.id).selection.servers).toEqual([]);
  const restored = await ctx.agents.create({
    sessionId: SessionId("changed-copy"),
    seed: handle.agent.session.snapshotEvents(),
  });
  expect(ctx.shinkuMcpManager.selection(restored.agent.id).selection.servers).toEqual(["b"]);
});

it("filters and guards session-local MCP registrations, while browsing unselected global tools", async () => {
  const ctx = await setup();
  const handle = await ctx.agents.create({ sessionId: SessionId("local") });
  handle.agent.ctx.tools.register(
    defineContentToolFixture({
      name: "mcp__b__scoped",
      description: "scoped",
      parameters: {},
      execute: async () => [],
    }),
  );
  ctx.shinkuMcpManager.select(handle.agent.id, choice(["a"]));
  const prompt = await ctx.systemPrompt.assemble({ scope: handle.agent });
  expect(prompt.tools.some((t) => t.name === "mcp__b__scoped")).toBe(false);
  expect((await call(ctx, handle.agent, "mcp__b__scoped")).isError).toBe(true);
  expect(
    ctx.shinkuMcpManager
      .sessionCatalog(handle.agent.id)
      .find((s) => s.id === "b")
      ?.tools.map((t) => t.name),
  ).toContain("mcp__b__echo");
});

it("accepts configuration changes while the native agent driver is running", async () => {
  const ctx = await setup();
  const handle = await ctx.agents.create({ sessionId: SessionId("running") });
  handle.agent.followup(
    createUserMessage({ content: [{ type: "text", text: "Test configuration admission" }], source: { kind: "user" } }),
  );
  try {
    expect(handle.agent.status).toBe("running");
    ctx.shinkuMcpManager.select(handle.agent.id, choice(["b"]));
    expect(ctx.shinkuMcpManager.selection(handle.agent.id).selection.servers).toEqual(["b"]);
  } finally {
    handle.agent.cancel({ kind: "user" });
    await handle.agent.whenIdle();
  }
});

it("inherits the exact selected snapshot into a child agent", async () => {
  const ctx = await setup();
  const parent = await ctx.agents.create({ sessionId: SessionId("parent") });
  ctx.shinkuMcpManager.select(parent.agent.id, choice(["b"]));
  const child = await parent.agent.ctx.agents.create({ sessionId: SessionId("child"), parentAgent: parent.agent });
  expect(ctx.shinkuMcpManager.selection(child.agent.id).selection.servers).toEqual(["b"]);
  expect((await call(ctx, child.agent, "mcp__a__echo")).isError).toBe(true);
});

class PresentationRuntime extends PtcRuntime {
  readonly language = "typescript";
  readonly isolation = "test";
  resolve(_request: PtcRunRequest): PtcRunSpec {
    throw new Error("Presentation-only fixture");
  }
  run(_spec: PtcRunSpec): Promise<PtcRunResult> {
    throw new Error("Presentation-only fixture");
  }
}

it("filters the PTC SDK and blocks nested programmatic dispatch to unselected scoped tools", async () => {
  const ctx = await setup();
  await ctx.plugin(PresentationRuntime);
  const handle = await ctx.agents.create({ sessionId: SessionId("ptc") });
  handle.agent.ctx.tools.register(
    defineContentToolFixture({
      name: "mcp__b__scoped",
      description: "blocked",
      parameters: {},
      execute: async () => [],
    }),
  );
  ctx.shinkuMcpManager.select(handle.agent.id, choice(["a"]));
  const dispose = handle.agent.ctx.tools.presentAs("ptc");
  const assembly = await ctx.systemPrompt.assemble({ scope: handle.agent });
  const sdk = assembly.sections.find((s) => s.name === "tools:sdk")?.text;
  expect(sdk).toContain("mcp__a__echo");
  expect(sdk).not.toContain("mcp__b__echo");
  expect(sdk).not.toContain("mcp__b__scoped");
  dispose();
  ctx.tools.register(
    defineContentToolFixture({
      name: "outer",
      description: "nested dispatch",
      parameters: {},
      async execute(_args, exec) {
        const result = await ctx.tools.execute({
          callId: ToolCallId("nested"),
          name: "mcp__b__scoped",
          arguments: {},
          agent: handle.agent,
          parent: exec.token,
          rootCallId: exec.rootCallId,
          signal: exec.signal,
        });
        expect(result.isError).toBe(true);
        return [];
      },
    }),
  );
  expect((await call(ctx, handle.agent, "outer")).isError).toBe(false);
});

it("restricts native MCP resource access and publishes only selected server names", async () => {
  const ctx = await setup();
  await ctx.plugin(McpResources);
  const handle = await ctx.agents.create({ sessionId: SessionId("resources") });
  ctx.shinkuMcpManager.select(handle.agent.id, choice(["a"]));
  expect((await call(ctx, handle.agent, "list_mcp_resources", { server: "a" })).isError).toBe(false);
  expect((await call(ctx, handle.agent, "list_mcp_resources", { server: "b" })).isError).toBe(true);
  const section = (await ctx.systemPrompt.assemble({ scope: handle.agent })).sections.find(
    (s) => s.name === "mcp-resource-servers",
  );
  expect(section?.text).toContain('["a"]');
  expect(section?.text).not.toContain('"b"');
});

it("preserves started legacy sessions and leaves new sessions at the empty default", async () => {
  const ctx = await setup(undefined, false);
  const old = await ctx.agents.create({ sessionId: SessionId("legacy") });
  old.agent.session.append("turn/start", { turn: 1 });
  await mount(ctx);
  expect(ctx.shinkuMcpManager.selection(old.agent.id).legacy).toBe(true);
  expect(ctx.tools.schemas(old.agent).filter((t) => t.name.startsWith("mcp__"))).toHaveLength(2);
  const fresh = await ctx.agents.create({ sessionId: SessionId("fresh") });
  expect(ctx.shinkuMcpManager.selection(fresh.agent.id).legacy).toBe(false);
  // An old chat retains access until the user explicitly chooses a configuration.
  ctx.shinkuMcpManager.select(old.agent.id, choice(["b"]));
  expect(ctx.shinkuMcpManager.selection(old.agent.id).legacy).toBe(false);
  expect((await call(ctx, old.agent, "mcp__a__echo")).isError).toBe(true);
  expect((await call(ctx, old.agent, "mcp__b__echo")).isError).toBe(false);
  expect(ctx.tools.schemas(fresh.agent).filter((t) => t.name.startsWith("mcp__"))).toHaveLength(0);
});

it("refuses an invalid persisted selection before the restored agent becomes usable", async () => {
  const ctx = await setup();
  const first = await ctx.agents.create({ sessionId: SessionId("valid") });
  const seed = JSON.parse(JSON.stringify(first.agent.session.snapshotEvents()));
  seed.find((event: { type: string }) => event.type === "plugin:shinku/mcp-manager/selection").data.version = 99;
  await expect(ctx.agents.create({ sessionId: SessionId("corrupted"), seed })).rejects.toThrow();
  expect(ctx.agents.list().some((agent) => agent.id === "corrupted")).toBe(false);
});
