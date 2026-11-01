// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import type { ManagerApi } from "../src/client/api.ts";
import { ProfilesPage } from "../src/client/components.tsx";
import { en, type LocaleKey } from "../src/client/locales.ts";
import { SessionCustomization, SessionIndicator } from "../src/client/session-components.tsx";
import { McpSessionController } from "../src/client/session-controller.ts";
import type { SelectionView } from "../src/contracts.ts";

afterEach(cleanup);
const t = (key: LocaleKey) => en[key];
function fixture() {
  const profiles = {
    profiles: [{ id: "dev", name: "Coding", servers: ["alpha"] }],
    defaultProfileId: "dev",
    revision: 3,
  };
  let view: SelectionView = {
    selection: { version: 1, profileId: "dev", profileName: "Coding", servers: ["alpha"] },
    locked: false,
    legacy: false,
  };
  const api: ManagerApi = {
    profiles: vi.fn(async () => structuredClone(profiles)),
    catalog: vi.fn(async () =>
      ["alpha", "beta"].map((id) => ({
        id,
        serverName: id,
        transport: "stdio",
        available: true,
        diagnostic: "",
        tools: [{ name: `mcp__${id}__echo`, description: `${id} echo tool`, parameterSchema: '{"type":"object"}' }],
      })),
    ),
    selection: vi.fn(async () => structuredClone(view)),
    select: vi.fn(async (_id, selection) => {
      view = { ...view, selection };
      return structuredClone(view);
    }),
    saveProfiles: vi.fn(async (document) => ({ ...document, revision: 4 })),
  };
  return {
    api,
    profiles,
    lock: () => {
      view.locked = true;
    },
  };
}

function show(api: ManagerApi, mode: "inspect" | "customize" = "customize") {
  const controller = new McpSessionController(api, "chat-a", t);
  render(<SessionCustomization controller={controller} t={t} />);
  controller.deferOpen(mode);
  onTestFinished(() => controller.dispose());
  return controller;
}

it("stages customization and reset locally, then applies one session copy", async () => {
  const { api, profiles } = fixture();
  const controller = show(api);
  fireEvent.click(await screen.findByRole("checkbox", { name: "beta" }));
  await screen.findByText("Modified");
  expect(controller.getSnapshot().view?.selection.servers).toEqual(["alpha"]);
  expect(api.select).not.toHaveBeenCalled();
  expect(screen.getByText("Current session only")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Profile" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset to profile" }));
  expect((screen.getByRole("checkbox", { name: "beta" }) as HTMLInputElement).checked).toBe(false);
  expect(api.select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "beta" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.select).toHaveBeenCalledExactlyOnceWith("chat-a", {
    version: 1,
    profileId: "dev",
    profileName: "Coding",
    servers: ["alpha", "beta"],
  });
  expect(profiles.profiles[0]?.servers).toEqual(["alpha"]);
  expect(api.saveProfiles).not.toHaveBeenCalled();
});

it("discards staged edits on Cancel", async () => {
  const { api } = fixture();
  const controller = show(api);
  fireEvent.click(await screen.findByRole("checkbox", { name: "beta" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(controller.getSnapshot().draft).toBeUndefined();
  expect(controller.getSnapshot().view?.selection.servers).toEqual(["alpha"]);
  expect(api.select).not.toHaveBeenCalled();
});

it("keeps the confirmed selection and editing draft on Apply failure", async () => {
  const { api } = fixture();
  api.select = vi.fn(async () => {
    throw new Error("write failed");
  });
  const controller = show(api);
  fireEvent.click(await screen.findByRole("checkbox", { name: "beta" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect((await screen.findByRole("alert")).textContent).toContain("write failed");
  expect((screen.getByRole("checkbox", { name: "beta" }) as HTMLInputElement).checked).toBe(true);
  expect(controller.getSnapshot().view?.selection.servers).toEqual(["alpha"]);
});

it("edits profiles through native controls and revisioned settings", async () => {
  const { api } = fixture();
  render(<ProfilesPage api={api} t={t} />);
  const name = await screen.findByRole("textbox", { name: "Profile name" });
  fireEvent.change(name, { target: { value: "Research" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "beta" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.saveProfiles).toHaveBeenCalledWith(
      { profiles: [{ id: "dev", name: "Research", servers: ["alpha", "beta"] }], defaultProfileId: "dev" },
      3,
    ),
  );
  expect(api.select).not.toHaveBeenCalled();
  expect(screen.queryByRole("combobox")).toBeNull();
});

it("uses a native menu with keyboard selection and focus return", async () => {
  const { api } = fixture();
  render(<ProfilesPage api={api} t={t} />);
  const button = await screen.findByRole("button", { name: "Profile" });
  await screen.findByRole("textbox", { name: "Profile name" });
  fireEvent.click(button);
  const none = await screen.findByRole("menuitem", { name: "None" });
  none.focus();
  fireEvent.keyDown(none, { key: "Tab" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(button);
  expect(screen.queryByRole("textbox", { name: "Profile name" })).toBeNull();
});

it("browses filtered tool descriptions and exact schemas without executing tools", async () => {
  const { api } = fixture();
  render(<ProfilesPage api={api} t={t} />);
  const search = await screen.findByRole("textbox", { name: "Search servers and tools" });
  await screen.findByRole("checkbox", { name: "alpha" });
  fireEvent.change(search, { target: { value: "beta echo tool" } });
  expect(screen.queryByRole("checkbox", { name: "alpha" })).toBeNull();
  expect(screen.getByText("mcp__beta__echo")).toBeDefined();
  expect(screen.getByText('{"type":"object"}')).toBeDefined();
  expect(api.select).not.toHaveBeenCalled();
});

it("shows only selected MCPs in the read-only inspector and keeps hierarchy browsing available", async () => {
  const { api } = fixture();
  show(api, "inspect");
  const dialog = await screen.findByRole("dialog", { name: "Session MCPs" });
  await within(dialog).findByText("alpha");
  expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
  expect(within(dialog).queryByText("beta")).toBeNull();
  expect(within(dialog).getByText("Ready")).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "Details · stdio" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "mcp__alpha__echo" }));
  expect(within(dialog).getByText('{"type":"object"}')).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "Customize…" }));
  expect(await screen.findByRole("dialog", { name: "Customize session MCPs" })).toBeDefined();
  expect(screen.getByRole("checkbox", { name: "beta" })).toBeDefined();
  expect(api.select).not.toHaveBeenCalled();
});

it("uses a native confirmation modal for staged profile deletion", async () => {
  const { api } = fixture();
  render(<ProfilesPage api={api} t={t} />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete profile" }));
  const modal = await screen.findByRole("dialog", { name: "Delete profile" });
  expect(modal.textContent).toContain("Existing sessions keep their selection");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.saveProfiles).not.toHaveBeenCalled();
});

it("returns focus after keyboard dismissal while preserving the surrounding composer draft and file", async () => {
  const { api } = fixture();
  const controller = new McpSessionController(api, "chat-a", t);
  const rendered = render(
    <>
      <textarea aria-label="Composer" defaultValue="/mcp keep this draft" />
      <input aria-label="Attachments" type="file" />
      <SessionCustomization controller={controller} t={t} />
    </>,
  );
  const composer = screen.getByRole("textbox", { name: "Composer" }) as HTMLTextAreaElement;
  const attachments = screen.getByLabelText("Attachments") as HTMLInputElement;
  const file = new File(["attachment contents"], "notes.txt", { type: "text/plain" });
  fireEvent.change(attachments, { target: { files: [file] } });
  composer.focus();
  controller.deferOpen();
  await screen.findByRole("checkbox", { name: "alpha" });
  expect(document.activeElement).not.toBe(composer);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(document.activeElement).toBe(composer));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(composer.value).toBe("/mcp keep this draft");
  expect(attachments.files?.[0]).toBe(file);
  rendered.unmount();
  controller.dispose();
});

it("opens inspection from a compact indicator and switches profiles through a separate native menu", async () => {
  const { api } = fixture();
  const controller = new McpSessionController(api, "chat-a", t);
  onTestFinished(() => controller.dispose());
  render(
    <>
      <SessionIndicator controller={controller} t={t} />
      <SessionCustomization controller={controller} t={t} />
    </>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "MCP · Coding · 1/1 Ready" }));
  const dialog = await screen.findByRole("dialog", { name: "Session MCPs" });
  await within(dialog).findByText("alpha");
  expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Switch Profile" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "None" }));
  await within(dialog).findByText("No MCPs selected");
  await screen.findByRole("button", { name: "MCP · None · 0 MCPs" });
  expect(api.select).toHaveBeenCalledExactlyOnceWith("chat-a", {
    version: 1,
    profileId: "",
    profileName: "",
    servers: [],
  });
});

it("updates the indicator's Modified state only after Apply", async () => {
  const { api } = fixture();
  const controller = new McpSessionController(api, "chat-a", t);
  onTestFinished(() => controller.dispose());
  render(
    <>
      <SessionIndicator controller={controller} t={t} />
      <SessionCustomization controller={controller} t={t} />
    </>,
  );
  const indicator = await screen.findByRole("button", { name: "MCP · Coding · 1/1 Ready" });
  fireEvent.click(indicator);
  fireEvent.click(await screen.findByRole("button", { name: "Customize…" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "beta" }));
  expect(indicator.getAttribute("aria-label")).toBe("MCP · Coding · 1/1 Ready");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await screen.findByRole("button", { name: "MCP · Coding · Modified · 2/2 Ready" });
});

it("distinguishes errors and disconnected selected servers without adding editing controls", async () => {
  const { api } = fixture();
  api.selection = vi.fn(
    async (): Promise<SelectionView> => ({
      locked: false,
      legacy: false,
      selection: { version: 1, profileId: "", profileName: "", servers: ["alpha", "beta", "missing"] },
    }),
  );
  api.catalog = vi.fn(async () => [
    { id: "alpha", serverName: "Alpha", transport: "stdio", available: false, diagnostic: "error", tools: [] },
    { id: "beta", serverName: "Beta", transport: "stdio", available: false, diagnostic: "not-ready", tools: [] },
  ]);
  show(api, "inspect");
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Alpha");
  expect(within(dialog).getByText("Error")).toBeDefined();
  expect(within(dialog).getAllByText("Disconnected")).toHaveLength(2);
  expect(within(dialog).getByText("Missing server")).toBeDefined();
  expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
});

it("shows unavailable status instead of stale readiness after catalog failures", async () => {
  const { api } = fixture();
  const controller = new McpSessionController(api, "chat-a", t);
  onTestFinished(() => controller.dispose());
  render(
    <>
      <SessionIndicator controller={controller} t={t} />
      <SessionCustomization controller={controller} t={t} />
    </>,
  );
  await screen.findByRole("button", { name: "MCP · Coding · 1/1 Ready" });
  api.catalog = vi.fn(async () => {
    throw new Error("catalog failed");
  });
  await act(async () => {
    await controller.load(true);
  });
  fireEvent.click(await screen.findByRole("button", { name: "MCP · Coding · Status unavailable" }));
  const dialog = await screen.findByRole("dialog", { name: "Session MCPs" });
  await within(dialog).findByRole("alert");
  expect(within(dialog).queryByText("Ready")).toBeNull();
  expect(within(dialog).getAllByText("Status unavailable").length).toBeGreaterThan(0);
});
