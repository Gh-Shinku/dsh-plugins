/** Read native Loader entries without copying transport settings or credentials. */
import type { Context } from "@deepseek-ai/cordis";
import { interpolate } from "@deepseek-ai/cordis-plugin-loader";
import type { ScopeKey } from "@deepseek-ai/dsh-scope";
import { scopeChainOf, scopeOf } from "@deepseek-ai/dsh-scope";
import type {} from "@deepseek-ai/dsh-tools";
import type { McpServerView } from "./contracts.ts";
import { serverForTool } from "./domain.ts";

/** Catalog reads do not connect, disconnect, or invoke any MCP server. */
export function readCatalog(ctx: Context, scope?: ScopeKey): McpServerView[] {
  const chain = new Set(scopeChainOf(scope));
  const servers: McpServerView[] = [];
  for (const entry of ctx.loader.entries()) {
    if (entry.options.name !== "@deepseek-ai/dsh-mcp-client") continue;
    const entryScope = scopeOf(entry.context);
    if (entryScope !== undefined && scope !== undefined && !chain.has(entryScope)) continue;
    const raw: unknown = entry.options.config;
    let serverName = entry.id;
    let transport = "unknown";
    let diagnostic = "";
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      // Interpolate only public identity fields: env, headers, args, and URLs never enter a response.
      const fields = raw as Record<string, unknown>;
      const identity: unknown = interpolate(entry.context, {
        serverName: fields.serverName,
        transport: fields.transport,
      });
      if (
        identity &&
        typeof identity === "object" &&
        "serverName" in identity &&
        typeof identity.serverName === "string"
      )
        serverName = identity.serverName;
      if (identity && typeof identity === "object" && "transport" in identity && typeof identity.transport === "string")
        transport = identity.transport;
    }
    const available = !entry.disabled && entry.fiber?.state === 2;
    if (entry.disabled) diagnostic = "disabled";
    else if (!available) diagnostic = "not-ready";
    servers.push({ id: entry.id, serverName, transport, available, diagnostic, tools: [] });
  }
  // The manager's own agent restrictions must not erase the browsable catalog.
  // A scoped registration shadows the global schema of the same name.
  const schemas = [...new Map([...ctx.tools.schemas(), ...ctx.tools.schemas(scope)].map((s) => [s.name, s])).values()];
  for (const schema of schemas) {
    const id = serverForTool(schema.name, servers);
    const server = servers.find((s) => s.id === id);
    if (server)
      server.tools.push({
        name: schema.name,
        description: schema.description ?? "",
        parameterSchema: JSON.stringify(schema.parameters, null, 2),
      });
  }
  return servers.sort((a, b) => a.serverName.localeCompare(b.serverName));
}
