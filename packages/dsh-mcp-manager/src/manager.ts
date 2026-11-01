/** Native settings, session snapshots, and final MCP admission enforcement. */
import { type Context, Service } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type {} from "@deepseek-ai/dsh-mcp-resources";
import type { Session, SessionId } from "@deepseek-ai/dsh-session";
import { appendPluginRecord, pluginRecordOf } from "@deepseek-ai/dsh-session";
import type {} from "@deepseek-ai/dsh-settings";
import type {} from "@deepseek-ai/dsh-system-prompt";
import type { ToolRestriction } from "@deepseek-ai/dsh-tools";
import { renderToolsSdk, renderToolsSdkPy } from "@deepseek-ai/dsh-tools";
import { bindTypertRemote, Remote, RemoteError } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";
import { readCatalog } from "./catalog.ts";
import type { McpServerView, ProfileDocument, ProfileSnapshot, SelectionView, SessionSelection } from "./contracts.ts";
import { allowsTool, defaultSelection, profileDocumentSchema, selectedNamespace, selectionSchema } from "./domain.ts";

export const RECORD = "plugin:shinku/mcp-manager/selection";

declare module "@deepseek-ai/dsh-session" {
  interface PluginRecordMap {
    "plugin:shinku/mcp-manager/selection": SessionSelection;
  }
}
declare module "@deepseek-ai/cordis" {
  interface Context {
    shinkuMcpManager: McpManager;
  }
}
declare module "@deepseek-ai/dsh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    "mcp-manager/locked": { sessionId: string };
    "mcp-manager/invalid": { reason: string };
    "mcp-manager/settings-unavailable": { reason: string };
  }
}

const template = z.object({
  id: z.string().required(),
  name: z.string().required(),
  servers: z.array(String).default([]),
});
export interface ManagerConfig {
  templates: { get(): unknown };
}
export const Config: z<{ templates?: ProfileDocument }, ManagerConfig> = z.object({
  templates: z
    .object({ profiles: z.array(template).default([]), defaultProfileId: z.string().default("") })
    .default({ profiles: [], defaultProfileId: "" })
    .volatile(),
});

/** Read and validate the last committed plugin record, including fork-inherited history. */
export function recordedSelection(session: Session): SessionSelection | undefined {
  for (const event of [...session.snapshotEvents()].reverse()) {
    const record = pluginRecordOf(event);
    if (record?.type === RECORD) return selectionSchema.parse(record.data);
  }
  return undefined;
}

/** Detect old chats that predate the manager's selection record. */
export function hasStarted(session: Session): boolean {
  return session.snapshotEvents().some((event) => event.type === "turn/start");
}

/** Host authority for reusable templates and per-session MCP admission. */
export class McpManager extends Service {
  readonly typertRemote = bindTypertRemote(this, "shinkuMcpManager");
  static inject = ["loader", "agents", "tools", "systemPrompt", "settings"];
  static Config: typeof Config = Config;
  private readonly owner: Context;
  private readonly restrictions = new Map<Agent, () => void>();
  private refreshing = false;
  private closed = false;

  constructor(
    ctx: Context,
    private readonly config: ManagerConfig,
  ) {
    super(ctx, "shinkuMcpManager");
    this.owner = ctx;
    this.document();
    ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber));
    ctx.on("agent/created", ({ agent }) => {
      this.attach(agent);
    });
    ctx.on("agent/disposed", ({ agent }) => {
      this.restrictions.delete(agent);
    });
    ctx.on("tools/change", () => {
      this.refreshRestrictions();
    });
    ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
      const assembly = await next();
      const agent = this.owner.agents.list().find((a) => a === context.scope);
      if (!agent) return assembly;
      const view = this.view(agent);
      if (view.legacy) return assembly;
      const servers = readCatalog(this.owner, agent);
      const allowed = (name: string): boolean => allowsTool(name, view.selection, servers);
      const sections = assembly.sections.filter((section) => {
        if (section.name.startsWith("mcp:")) return selectedNamespace(section.name.slice(4), view.selection, servers);
        return section.name !== "mcp-resource-servers";
      });
      const resources = assembly.sections.find((s) => s.name === "mcp-resource-servers");
      const resourceNames = servers
        .filter((s) => selectedNamespace(s.serverName, view.selection, servers))
        .map((s) => s.serverName);
      if (resources && resourceNames.length)
        sections.push({
          ...resources,
          text: `## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: ${JSON.stringify(resourceNames)}.`,
        });
      for (const section of sections) {
        if (section.name !== "tools:sdk" || !section.text) continue;
        const runtime = agent.ctx.get("ptcRuntime");
        if (!runtime) throw new Error("MCP filtering requires the active PTC runtime");
        const schemas = this.owner.tools
          .schemas(agent)
          .filter((s) => s.name !== "run_code" && allowed(s.name))
          .map((s) => {
            const definition = this.owner.tools.get(s.name, agent);
            if (!definition) throw new Error(`Tool disappeared during MCP schema projection: ${s.name}`);
            return { ...s, output: definition.output.schema };
          });
        section.text =
          runtime.language === "python" ? renderToolsSdkPy(schemas) : renderToolsSdk(schemas, runtime.programFormat);
      }
      return { ...assembly, sections, tools: assembly.tools.filter((tool) => allowed(tool.name)) };
    });
    ctx.effect(() =>
      ctx.tools.guard((exec) => {
        if (!exec.agent) return undefined;
        const view = this.view(exec.agent);
        if (view.legacy) return undefined;
        return allowsTool(exec.name, view.selection, readCatalog(this.owner, exec.agent), exec.arguments)
          ? undefined
          : "MCP server is not selected for this session";
      }),
    );
    // Loading the plugin into an already running Host preserves started legacy chats.
    for (const agent of ctx.agents.list()) this.attach(agent);
    ctx.effect(() => () => {
      this.closed = true;
      for (const dispose of this.restrictions.values()) dispose();
      this.restrictions.clear();
    });
  }

  /** Read the native configuration revision and validated template collection. */
  @Remote
  profiles(): ProfileSnapshot {
    const descriptor = this.settingsDescriptor();
    return { ...profileDocumentSchema.parse(this.config.templates.get()), revision: descriptor.revision };
  }

  /** Replace templates through Harness's optimistic, persistent settings writer. */
  @Remote
  async saveProfiles(document: ProfileDocument, revision: number): Promise<ProfileSnapshot> {
    const checked = profileDocumentSchema.safeParse(document);
    if (!checked.success)
      throw new RemoteError("mcp-manager/invalid", "Invalid MCP profiles", { reason: checked.error.message });
    const descriptor = this.settingsDescriptor();
    await this.owner.settings.update(descriptor.ns, { templates: checked.data }, revision);
    return this.profiles();
  }

  /** List configured native servers across the deployment for template editing. */
  @Remote
  catalog(): McpServerView[] {
    return readCatalog(this.owner);
  }

  /** List the inherited native MCP catalog for one exact session. */
  @Remote({ resources: { session: (sessionId: string) => sessionId as SessionId } })
  sessionCatalog(sessionId: string): McpServerView[] {
    return readCatalog(this.owner, this.agent(sessionId));
  }

  /** Read a session's detached selection. Chatting does not lock configuration. */
  @Remote({ resources: { session: (sessionId: string) => sessionId as SessionId } })
  selection(sessionId: string): SelectionView {
    return this.view(this.agent(sessionId));
  }

  /** Save a session copy and refresh admission, including during an active chat. */
  @Remote({ resources: { session: (sessionId: string) => sessionId as SessionId } })
  select(sessionId: string, selection: SessionSelection): SelectionView {
    const agent = this.agent(sessionId);
    const checked = selectionSchema.safeParse(selection);
    if (!checked.success)
      throw new RemoteError("mcp-manager/invalid", "Invalid MCP selection", { reason: checked.error.message });
    // Missing ids remain in a snapshot as unavailable; they never grant access to other servers.
    appendPluginRecord(agent.session, RECORD, checked.data);
    this.refreshRestrictions();
    return this.view(agent);
  }

  private settingsDescriptor(): ReturnType<Context["settings"]["describe"]>[number] {
    const entryId = this.owner.fiber.entry?.options.id;
    const descriptor = this.owner.settings.describe().find((d) => d.ns === entryId);
    if (!descriptor)
      throw new RemoteError(
        "mcp-manager/settings-unavailable",
        "MCP manager needs a uniquely addressed native plugin entry",
        { reason: "Use the supplied Cordis bundle" },
      );
    return descriptor;
  }

  private document(): ProfileDocument {
    return profileDocumentSchema.parse(this.config.templates.get());
  }

  private agent(sessionId: string): Agent {
    const agent = this.owner.agents.list().find((a) => a.id === sessionId);
    if (!agent) throw new RemoteError("mcp-manager/invalid", "Session is not active", { reason: sessionId });
    return agent;
  }

  private view(agent: Agent): SelectionView {
    const selection = recordedSelection(agent.session);
    return {
      selection: selection ?? defaultSelection({ profiles: [], defaultProfileId: "" }),
      locked: false,
      legacy: selection === undefined && hasStarted(agent.session),
    };
  }

  private attach(agent: Agent): void {
    if (recordedSelection(agent.session) === undefined && !hasStarted(agent.session)) {
      const parent = this.owner.agents.list().find((a) => a !== agent && this.owner.agents.isOwnedBy(agent.id, a));
      const inherited = parent === undefined ? undefined : recordedSelection(parent.session);
      appendPluginRecord(agent.session, RECORD, inherited ?? defaultSelection(this.document()));
    }
    this.refreshRestrictions();
  }

  private refreshRestrictions(): void {
    if (this.refreshing || this.closed) return;
    this.refreshing = true;
    try {
      for (const agent of this.owner.agents.list()) {
        const view = this.view(agent);
        this.restrictions.get(agent)?.();
        this.restrictions.delete(agent);
        if (view.legacy) continue;
        const servers = readCatalog(this.owner, agent);
        const deny = this.owner.tools
          .schemas()
          .filter((s) => !allowsTool(s.name, view.selection, servers))
          .map((s) => s.name);
        if (deny.length) {
          const filter: ToolRestriction = { deny };
          this.restrictions.set(agent, agent.ctx.tools.restrict(filter));
        }
      }
    } finally {
      this.refreshing = false;
    }
  }
}
