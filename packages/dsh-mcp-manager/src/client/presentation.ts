import type { McpServerView, ProfileSnapshot, SelectionView } from "../contracts.ts";
import type { T } from "./locales.ts";

export function sameServers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function isModified(view: SelectionView, profiles?: ProfileSnapshot): boolean {
  if (view.legacy) return false;
  const profile = profiles?.profiles.find((p) => p.id === view.selection.profileId);
  return profile
    ? !sameServers(profile.servers, view.selection.servers)
    : !!view.selection.profileId || view.selection.servers.length > 0;
}

export function selectionName(view: SelectionView, profiles: ProfileSnapshot | undefined, t: T): string {
  if (view.legacy) return t("inherited");
  return (
    view.selection.profileName ||
    profiles?.profiles.find((p) => p.id === view.selection.profileId)?.name ||
    t(view.selection.servers.length ? "custom" : "none")
  );
}

/** Only report errors explicitly supplied by the existing catalog; not-ready is disconnected. */
export function runtimeStatus(server?: McpServerView): "ready" | "runtimeError" | "disconnected" {
  if (server?.available) return "ready";
  return server?.diagnostic === "error" || server?.diagnostic === "failed" ? "runtimeError" : "disconnected";
}

export function sessionHealth(view: SelectionView, servers: McpServerView[]) {
  const selected = view.legacy ? servers.map((server) => server.id) : view.selection.servers;
  const statuses = selected.map((id) => runtimeStatus(servers.find((server) => server.id === id)));
  return {
    total: selected.length,
    ready: statuses.filter((status) => status === "ready").length,
    errors: statuses.filter((status) => status === "runtimeError").length,
  };
}

export function profileSummary(ids: string[], servers: McpServerView[], t: T): string {
  const names = ids.slice(0, 3).map((id) => servers.find((server) => server.id === id)?.serverName ?? id);
  return [
    `${ids.length} ${t(ids.length === 1 ? "server" : "servers")}`,
    names.join(", ") + (ids.length > 3 ? ` +${ids.length - 3}` : ""),
  ]
    .filter(Boolean)
    .join(" · ");
}
