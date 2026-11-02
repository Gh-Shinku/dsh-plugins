// @vitest-environment jsdom
import type { Context } from "@deepseek-ai/cordis";
import { afterEach, expect, it, vi } from "vitest";
import { apply } from "../src/client/index.ts";
import { en, type LocaleKey } from "../src/client/locales.ts";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const stop of cleanups.splice(0).reverse()) stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "dshDesktop");
});
async function fixture(
  permission: NotificationPermission = "default",
  request?: () => Promise<NotificationPermission>,
) {
  Object.assign(window, { dshDesktop: { protocolVersion: 1 } });
  const sent: FakeNotification[] = [];
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(
      request ??
        (async () => {
          FakeNotification.permission = "granted";
          return "granted" as NotificationPermission;
        }),
    );
    onclick: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    close = vi.fn();
    constructor(
      readonly title: string,
      readonly options: NotificationOptions,
    ) {
      sent.push(this);
    }
  }
  vi.stubGlobal("Notification", FakeNotification);
  const statusListeners = new Set<() => void>();
  const status = new Map();
  const row = { id: "one", running: false, title: "My task", retainedBy: {} };
  const list = { ids: ["one"], byId: { one: row }, phase: "ready" };
  const subscribe = () => () => {};
  const t = (key: LocaleKey) => en[key];
  const ctx = {
    effect: (setup: () => () => void) => {
      cleanups.push(setup());
    },
    locale: { register: () => () => {}, bind: () => t },
    configForms: {
      get: () => {
        throw new Error("Unexpected settings access");
      },
    },
    sessions: { list: { getSnapshot: () => list, subscribe } },
    uiSession: {
      sessionStatus: {
        getSnapshot: () => status,
        subscribe: (listener: () => void) => {
          statusListeners.add(listener);
          return () => {
            statusListeners.delete(listener);
          };
        },
      },
    },
    remote: {
      $mount: vi.fn(async () => () => {}),
      shinkuDesktopNotifications: { activate: vi.fn(async () => ({ ok: true, value: undefined })) },
    },
    inject: (_services: string[], callback: (inner: unknown) => void) => callback(ctx),
    uiWorkspace: { openSession: vi.fn() },
    get: () => ({ generation: { getSnapshot: () => 1, subscribe } }),
    slots: {
      inject: () => {
        throw new Error("Unexpected settings registration");
      },
    },
  };
  await apply(ctx as unknown as Context);
  const waiting = () => {
    status.set("one", { pendingInteraction: { kind: "question", key: "new" } });
    for (const listener of statusListeners) listener();
  };
  return { sent, FakeNotification, waiting, ctx };
}

it("does nothing in Web clients and does not request notification permission", async () => {
  const h = await fixture("granted");
  Reflect.deleteProperty(window, "dshDesktop");
  await expect(
    apply(
      new Proxy({} as Context, {
        get() {
          throw new Error("Unexpected service access");
        },
      }),
    ),
  ).resolves.toBeUndefined();
  expect(h.FakeNotification.requestPermission).not.toHaveBeenCalled();
});

it("enables automatically and requests desktop permission without creating a settings page", async () => {
  const h = await fixture();
  expect(h.FakeNotification.requestPermission).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(h.sent).toHaveLength(0);
  h.waiting();
  expect(h.sent).toHaveLength(1);
  expect(h.sent[0].options.body).toBe(en.waiting);
  expect(h.sent[0].options.tag).toBeUndefined();
  for (const stop of cleanups.splice(0).reverse()) stop();
  expect(h.sent[0].close).toHaveBeenCalledOnce();
  expect(h.sent[0].onclick).toBeNull();
});

it("does not re-request denied permission or send notifications", async () => {
  const h = await fixture("denied");
  h.waiting();
  expect(h.FakeNotification.requestPermission).not.toHaveBeenCalled();
  expect(h.sent).toHaveLength(0);
});

it("contains permission failures without retrying on task events", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await fixture("default", async () => {
    throw new Error("Permission unavailable");
  });
  await Promise.resolve();
  h.waiting();
  expect(warn).toHaveBeenCalledOnce();
  expect(h.FakeNotification.requestPermission).toHaveBeenCalledOnce();
  expect(h.sent).toHaveLength(0);
});

it("does not resume notification work after disposal during permission initialization", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  let settle: ((value: NotificationPermission) => void) | undefined;
  const h = await fixture(
    "default",
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  for (const stop of cleanups.splice(0).reverse()) stop();
  settle?.("denied");
  await Promise.resolve();
  h.waiting();
  expect(warn).not.toHaveBeenCalled();
  expect(h.sent).toHaveLength(0);
});

it.each([
  ["visible", true, 0],
  ["visible", false, 1],
  ["hidden", true, 1],
] as const)("uses visibility=%s and focus=%s before delivery", async (visibility, focused, count) => {
  const h = await fixture("granted");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
  vi.spyOn(document, "hasFocus").mockReturnValue(focused);
  vi.spyOn(window, "focus").mockImplementation(() => {});
  h.waiting();
  expect(h.sent).toHaveLength(count);
  if (count) {
    h.sent[0].onclick?.();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(h.ctx.remote.shinkuDesktopNotifications.activate).toHaveBeenCalledOnce();
    expect(h.ctx.uiWorkspace.openSession).toHaveBeenCalledWith("one");
  }
});
