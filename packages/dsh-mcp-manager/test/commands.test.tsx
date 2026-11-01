// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import * as cordis from "@deepseek-ai/cordis";
import * as store from "@deepseek-ai/dsh-client-store";
import type { ClientSessionContext, InputTriggerSource } from "@deepseek-ai/dsh-client-ui-input-trigger/client";
import * as primitives from "@deepseek-ai/dsh-client-ui-primitives";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import * as react from "react";
import * as jsx from "react/jsx-runtime";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import type { ManagerApi } from "../src/client/api.ts";
import { McpIcon } from "../src/client/icon.tsx";
import { en, type LocaleKey } from "../src/client/locales.ts";
import { McpSessionController, mcpCommand } from "../src/client/session-controller.ts";
import type { SelectionView } from "../src/contracts.ts";

// Exercise the installed Harness browser factory using its real platform modules.
// No dependency source is patched and no alternate command implementation is tested.
const modules: Record<string, unknown> = {
  "@deepseek-ai/cordis": cordis,
  "@deepseek-ai/dsh-client-store": store,
  "@deepseek-ai/dsh-client-ui-primitives": primitives,
  "react/jsx-runtime": jsx,
  react,
};
let native: typeof import("@deepseek-ai/dsh-client-ui-commands/client");
runInThisContext(
  `(window) => {${readFileSync(new URL(import.meta.resolve("@deepseek-ai/dsh-client-ui-commands/client")), "utf8")}\n}`,
)({
  __ModuleLoader__: {
    load: ({ factory }: { factory: (require: (id: string) => unknown) => typeof native }) => {
      native = factory((id) => {
        if (!(id in modules)) throw new Error(`Unexpected native import ${id}`);
        return modules[id];
      });
    },
  },
});

const t = (key: LocaleKey) => en[key];
const session: ClientSessionContext = { sessionId: "chat-a" as SessionId };
afterEach(() => vi.useRealTimers());

function fixture() {
  const profiles = {
    profiles: [{ id: "dev", name: "Coding", servers: ["alpha", "beta"] }],
    defaultProfileId: "dev",
    revision: 3,
  };
  let view: SelectionView = {
    selection: { version: 1, profileId: "dev", profileName: "Coding", servers: ["beta", "alpha"] },
    locked: false,
    legacy: false,
  };
  let current = true;
  const api: ManagerApi = {
    profiles: vi.fn(async () => profiles),
    selection: vi.fn(async () => view),
    catalog: vi.fn(async () =>
      ["alpha", "beta"].map((id) => ({
        id,
        serverName: id,
        transport: "stdio",
        available: true,
        diagnostic: "",
        tools: [{ name: `mcp__${id}__echo`, description: "Echo", parameterSchema: "{}" }],
      })),
    ),
    select: vi.fn(async (_id, selection) => {
      view = { ...view, selection };
      return view;
    }),
    saveProfiles: vi.fn(async () => profiles),
  };
  const controller = new McpSessionController(api, session.sessionId, t, () => current);
  const contribution = mcpCommand(
    () => controller,
    t,
    () => current,
  );
  if (contribution.ui.kind !== "popupSelect") throw new Error("Expected native popup command");
  onTestFinished(() => controller.dispose());
  return {
    api,
    controller,
    contribution,
    spec: contribution.ui,
    profiles,
    view,
    replace: () => {
      current = false;
      controller.dispose();
    },
  };
}

it("registers one MCP contribution in the native command source for slash and Add menus", async () => {
  const ctx = new cordis.Context();
  onTestFinished(() => ctx.fiber.dispose());
  const registered: InputTriggerSource[] = [];
  ctx.provide("locale", { bind: () => (key: string) => key } as never);
  ctx.provide("inputTriggers", {
    registerSource: (source: InputTriggerSource) => {
      registered.push(source);
      return () => registered.splice(registered.indexOf(source), 1);
    },
  } as never);
  const binding = { session: { getSnapshot: () => ({ openState: "open" }) } };
  ctx.provide("sessions", {
    binding: () => binding,
    subagentAddress: () => undefined,
    using: async (_id: string, _owner: unknown, action: (ref: unknown) => unknown) => action({ binding }),
  } as never);
  const commandsRemote = { list: async () => ({ ok: true, value: [] }) };
  ctx.provide("remote", { commands: commandsRemote, $on: () => () => {} } as never);
  ctx.provide("remote.commands", commandsRemote as never);
  const fiber = ctx.plugin(native.CommandUiRuntime);
  await fiber.await();
  const { contribution, replace } = fixture();
  const command = ctx.get("commandUi");
  if (!command) throw new Error("Native command service did not start");
  const remove = command.register(contribution);
  expect(registered).toHaveLength(1);
  const source = registered[0];
  if (!source) throw new Error("No native command source");
  expect([source.trigger, source.name]).toEqual(["/", "command"]);
  expect(contribution.icon).toBe(McpIcon);
  const candidates = (query: string, position: "leading" | "inline") =>
    source.candidates(session, { query, position, drilled: false, signal: new AbortController().signal });
  // Typed line-start slash and the Add launcher's unfiltered command source.
  expect((await candidates("mcp", "leading")).map((row) => row.name)).toEqual(["mcp"]);
  expect((await candidates("", "inline")).filter((row) => row.name === "mcp")).toHaveLength(1);
  replace();
  expect(await candidates("mcp", "leading")).toEqual([]);
  remove();
  await fiber.dispose();
  expect(registered).toHaveLength(0);
});

it.each(["normal", "chatting", "legacy"])(
  "keeps the profile picker focused on configuration for %s sessions",
  async (kind) => {
    const { spec, view } = fixture();
    view.locked = kind === "chatting";
    view.legacy = kind === "legacy";
    const rows = await spec.options(session, new AbortController().signal);
    expect(rows.map((row) => row.id)).toEqual(["none", "profile:dev", "customize"]);
    expect(rows.find((row) => row.id === "profile:dev")?.detail).toBe("2 servers · alpha, beta");
    expect(rows.some((row) => row.id.startsWith("server:") || row.id.startsWith("status:"))).toBe(false);
  },
);

it("marks membership matches, customized copies and None, without modifying templates", async () => {
  const { spec, view, controller, api, profiles } = fixture();
  const active = async () =>
    (await spec.options(session, new AbortController().signal)).filter((row) => row.active).map((row) => row.id);
  expect(await active()).toEqual(["profile:dev"]);
  view.selection.servers = ["alpha"];
  expect(await active()).toEqual(["customize"]);
  await controller.applyProfile("dev");
  expect(vi.mocked(api.select).mock.calls[0]?.[1].servers).not.toBe(profiles.profiles[0]?.servers);
  await controller.applyProfile("");
  expect(await active()).toEqual(["none"]);
  expect(profiles.profiles[0]?.servers).toEqual(["alpha", "beta"]);
});

it("opens staged customization only after native token consumption and composer focus", async () => {
  vi.useFakeTimers();
  const { spec, controller } = fixture();
  const consume = vi.fn(() => true);
  const focusComposer = vi.fn(() => expect(controller.getSnapshot().open).toBe(false));
  const popup = new native.PopupSelectController<ClientSessionContext>({ consume, focusComposer });
  onTestFinished(() => popup.dispose());
  const span = { start: 0, end: 4, draftRev: 7 };
  popup.open("mcp", spec, session, { via: "menu", span });
  await vi.waitFor(() => expect(popup.state.getSnapshot().status).toBe("ready"));
  await popup.select(2);
  expect(consume).toHaveBeenCalledExactlyOnceWith({ via: "menu", span });
  expect(focusComposer).toHaveBeenCalledOnce();
  expect(controller.getSnapshot().open).toBe(false);
  await vi.runAllTimersAsync();
  expect(controller.getSnapshot()).toMatchObject({
    open: true,
    mode: "customize",
    draft: { servers: ["beta", "alpha"] },
  });
});

it("preserves native dismissal, token guards and save-failure retry", async () => {
  const { spec, api } = fixture();
  const consume = vi.fn(() => false);
  const focusComposer = vi.fn();
  const popup = new native.PopupSelectController<ClientSessionContext>({ consume, focusComposer });
  onTestFinished(() => popup.dispose());
  const open = () => popup.open("mcp", spec, session, { via: "enter", token: "/mcp" });
  open();
  await vi.waitFor(() => expect(popup.state.getSnapshot().status).toBe("ready"));
  popup.dismiss({ focusComposer: true });
  expect(consume).not.toHaveBeenCalled();
  expect(api.select).not.toHaveBeenCalled();
  expect(focusComposer).toHaveBeenCalledOnce();
  api.select = vi.fn(async () => {
    throw new Error("write failed");
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  onTestFinished(() => log.mockRestore());
  open();
  await vi.waitFor(() => expect(popup.state.getSnapshot().status).toBe("ready"));
  await popup.select(0);
  expect(popup.state.getSnapshot()).toMatchObject({ open: true, error: "write failed", submitting: false });
  expect(consume).not.toHaveBeenCalled();
  api.select = vi.fn(async (_id, selection) => ({ selection, locked: false, legacy: false }));
  await popup.select(0);
  expect(consume).toHaveBeenCalledOnce();
  expect(popup.state.getSnapshot().open).toBe(false);
});

it("stages changes, keeps them across runtime refreshes and discards them on Cancel", async () => {
  const { controller, api } = fixture();
  await controller.load();
  controller.customize();
  controller.editServers(["alpha"]);
  await controller.load(true);
  expect(controller.getSnapshot().draft?.servers).toEqual(["alpha"]);
  expect(controller.getSnapshot().view?.selection.servers).toEqual(["beta", "alpha"]);
  expect(api.select).not.toHaveBeenCalled();
  controller.resetDraft();
  expect(controller.getSnapshot().draft?.servers).toEqual(["alpha", "beta"]);
  controller.close();
  expect(controller.getSnapshot().draft).toBeUndefined();
  controller.customize();
  controller.editServers([]);
  await controller.applyDraft();
  expect(api.select).toHaveBeenCalledOnce();
  expect(controller.getSnapshot()).toMatchObject({ open: false, view: { selection: { servers: [] } } });
});

it("preserves a failed draft for retry and revalidates disappearing profiles", async () => {
  const { controller, api, profiles } = fixture();
  await controller.load();
  controller.customize();
  controller.editServers([]);
  api.select = vi.fn(async () => {
    throw new Error("write failed");
  });
  await expect(controller.applyDraft()).rejects.toThrow("write failed");
  expect(controller.getSnapshot()).toMatchObject({
    open: true,
    draft: { servers: [] },
    view: { selection: { servers: ["beta", "alpha"] } },
  });
  profiles.profiles = [];
  await expect(controller.applyProfile("dev")).rejects.toThrow(en.profileUnavailable);
  expect(api.select).toHaveBeenCalledOnce();
});

it("does not let a stale read or a closed modal discard a confirmed write", async () => {
  const { controller, api, view } = fixture();
  await controller.load();
  let finish: (view: SelectionView) => void = () => {};
  api.selection = vi.fn(
    () =>
      new Promise<SelectionView>((resolve) => {
        finish = resolve;
      }),
  );
  const read = controller.load(true);
  await controller.save({ version: 1, profileId: "", profileName: "", servers: [] });
  controller.close();
  finish(view);
  await read;
  expect(controller.getSnapshot().view?.selection.servers).toEqual([]);
});

it("cancels deferred openings and stale profile preparations when the session is replaced", async () => {
  vi.useFakeTimers();
  const { controller, api, profiles, replace } = fixture();
  let finish: (value: typeof profiles) => void = () => {};
  api.profiles = vi.fn(
    () =>
      new Promise<typeof profiles>((resolve) => {
        finish = resolve;
      }),
  );
  const write = controller.applyProfile("dev");
  const rejected = expect(write).rejects.toThrow(en.sessionChanged);
  controller.deferOpen("inspect");
  replace();
  finish(profiles);
  await rejected;
  await vi.runAllTimersAsync();
  expect(controller.getSnapshot().open).toBe(false);
  expect(api.select).not.toHaveBeenCalled();
});

it("ignores write results for replaced bindings and never closes another editing surface", async () => {
  const { controller, api, replace, view } = fixture();
  await controller.load();
  let finish: (value: SelectionView) => void = () => {};
  api.select = vi.fn(
    () =>
      new Promise<SelectionView>((resolve) => {
        finish = resolve;
      }),
  );
  const confirmed = controller.getSnapshot().view;
  const write = controller.save({ version: 1, profileId: "", profileName: "", servers: [] });
  await vi.waitFor(() => expect(api.select).toHaveBeenCalled());
  replace();
  finish({ ...view, selection: { ...view.selection, servers: [] } });
  await write;
  expect(controller.getSnapshot().view).toBe(confirmed);
});

it("bounds visible status refreshes, pauses hidden sessions and disposes timers", async () => {
  vi.useFakeTimers();
  const { controller, api } = fixture();
  const first = controller.watch();
  const second = controller.watch();
  await vi.advanceTimersByTimeAsync(0);
  expect(api.selection).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(api.selection).toHaveBeenCalledTimes(2);
  controller.setVisible(false);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(api.selection).toHaveBeenCalledTimes(2);
  controller.setVisible(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(api.selection).toHaveBeenCalledTimes(3);
  first();
  second();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(api.selection).toHaveBeenCalledTimes(3);
  controller.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps inherited access until an explicit legacy customization is applied", async () => {
  const { controller, view, api } = fixture();
  view.legacy = true;
  await controller.load();
  controller.customize();
  expect(controller.getSnapshot().draft?.servers).toEqual(["alpha", "beta"]);
  expect(api.select).not.toHaveBeenCalled();
  controller.close();
  expect(controller.getSnapshot().view?.legacy).toBe(true);
  controller.customize();
  controller.editServers(["beta"]);
  await controller.applyDraft();
  expect(api.select).toHaveBeenCalledWith(session.sessionId, {
    version: 1,
    profileId: "",
    profileName: "",
    servers: ["beta"],
  });
});

it("keeps profile choices usable when runtime status cannot load", async () => {
  const { spec, controller, api } = fixture();
  api.catalog = vi.fn(async () => {
    throw new Error("catalog unavailable");
  });
  expect((await spec.options(session, new AbortController().signal)).map((row) => row.id)).toEqual([
    "none",
    "profile:dev",
    "customize",
  ]);
  expect(controller.getSnapshot().statusError).toBe("catalog unavailable");
});
