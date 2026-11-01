/** Validation at settings, Remote, and persisted-record boundaries. */
import { z } from "zod";
import type { ProfileDocument, SessionSelection } from "./contracts.ts";

export const serverIds = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate server id");
export const profileDocumentSchema = z
  .object({
    profiles: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1), servers: serverIds })),
    defaultProfileId: z.string(),
  })
  .superRefine((doc, ctx) => {
    if (new Set(doc.profiles.map((p) => p.id)).size !== doc.profiles.length)
      ctx.addIssue({ code: "custom", message: "Duplicate profile id" });
    if (doc.defaultProfileId && !doc.profiles.some((p) => p.id === doc.defaultProfileId))
      ctx.addIssue({ code: "custom", message: "Default profile does not exist" });
  });

export const selectionSchema = z.object({
  version: z.literal(1),
  profileId: z.string(),
  profileName: z.string(),
  servers: serverIds,
});

/** Resolve a detached default snapshot; no profile is the explicit empty selection. */
export function defaultSelection(document: ProfileDocument): SessionSelection {
  const profile = document.profiles.find((p) => p.id === document.defaultProfileId);
  return {
    version: 1,
    profileId: profile?.id ?? "",
    profileName: profile?.name ?? "",
    servers: [...(profile?.servers ?? [])],
  };
}

/** Native MCP namespaces preserve the server prefix even when the raw name is hashed. */
export function serverForTool(
  name: string,
  servers: readonly { id: string; serverName: string }[],
): string | undefined {
  const matches = servers.filter((s) => name.startsWith(`mcp__${s.serverName}__`));
  // Double underscores are legal in server names; multiple matches must never grant access.
  return matches.length === 1 ? matches[0]?.id : undefined;
}

export const RESOURCE_TOOLS = new Set(["list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"]);

/** A resource namespace must identify exactly one inherited server. */
export function selectedNamespace(
  name: string,
  selection: SessionSelection,
  servers: readonly { id: string; serverName: string }[],
): boolean {
  const matches = servers.filter((s) => s.serverName === name);
  return matches.length === 1 && selection.servers.includes(matches[0]?.id ?? "");
}

/** Single policy shared by declaration filtering and the final execution guard. */
export function allowsTool(
  name: string,
  selection: SessionSelection,
  servers: readonly { id: string; serverName: string }[],
  args?: unknown,
): boolean {
  if (RESOURCE_TOOLS.has(name)) {
    if (args === undefined) return selection.servers.some((id) => servers.some((s) => s.id === id));
    const parsed = z.object({ server: z.string() }).safeParse(args);
    return parsed.success && selectedNamespace(parsed.data.server, selection, servers);
  }
  if (!name.startsWith("mcp__")) return true;
  const id = serverForTool(name, servers);
  return id !== undefined && selection.servers.includes(id);
}
