import { describe, expect, it } from "vitest";
import { allowsTool, defaultSelection, profileDocumentSchema, selectionSchema, serverForTool } from "../src/domain.ts";

describe("MCP templates and session snapshots", () => {
  it("copies the default profile without retaining mutable template arrays", () => {
    const document = { profiles: [{ id: "coding", name: "Coding", servers: ["git"] }], defaultProfileId: "coding" };
    const selected = defaultSelection(document);
    selected.servers.push("web");
    expect(document.profiles[0]?.servers).toEqual(["git"]);
    expect(defaultSelection({ profiles: [], defaultProfileId: "" }).servers).toEqual([]);
  });
  it("rejects duplicate identities, missing defaults and malformed saved selections", () => {
    expect(profileDocumentSchema.safeParse({ profiles: [], defaultProfileId: "missing" }).success).toBe(false);
    expect(
      profileDocumentSchema.safeParse({
        profiles: [
          { id: "x", name: "X", servers: [] },
          { id: "x", name: "Y", servers: [] },
        ],
        defaultProfileId: "",
      }).success,
    ).toBe(false);
    expect(selectionSchema.safeParse({ version: 2, profileId: "", profileName: "", servers: [] }).success).toBe(false);
  });
  it("uses exact namespaces, refuses ambiguous prefixes and checks resource server arguments", () => {
    const servers = [
      { id: "a", serverName: "git" },
      { id: "b", serverName: "git__admin" },
    ];
    const selection = { version: 1 as const, profileId: "", profileName: "", servers: ["a"] };
    expect(allowsTool("mcp__git__echo", selection, servers)).toBe(true);
    expect(allowsTool("mcp__other__echo", selection, servers)).toBe(false);
    expect(serverForTool("mcp__git__admin__delete", servers)).toBeUndefined();
    expect(allowsTool("read_mcp_resource", selection, servers, { server: "git__admin" })).toBe(false);
    expect(allowsTool("read_mcp_resource", selection, servers, { server: "git", uri: "test://x" })).toBe(true);
    expect(allowsTool("read_file", selection, servers)).toBe(true);
  });
});
