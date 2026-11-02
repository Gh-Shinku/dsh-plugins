// @vitest-environment jsdom
import type { Context } from "@deepseek-ai/cordis";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apply } from "../src/client/index.ts";
import { en, type LocaleKey } from "../src/client/locales.ts";
import { NotificationSettings, type Preferences } from "../src/client/settings.tsx";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const stop of cleanups.splice(0).reverse()) stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "dshDesktop");
});
function fixture(permission: NotificationPermission = "default") {
  Object.assign(window, { dshDesktop: { protocolVersion: 1 } });
  const sent: FakeNotification[] = [];
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = "granted";
      return "granted" as NotificationPermission;
    });
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
  const snapshot = { status: "ready", writable: true, value: { enabled: true } };
  const form = {
    getSnapshot: () => snapshot,
    subscribe,
    set: vi.fn(async () => true),
  } as unknown as ConfigForm<Preferences>;
  let props: { test(): Promise<void>; permission(): NotificationPermission } | undefined;
  const t = (key: LocaleKey) => en[key];
  const ctx = {
    effect: (setup: () => () => void) => {
      cleanups.push(setup());
    },
    locale: { register: () => () => {}, bind: () => t },
    configForms: { get: () => form },
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
    uiWorkspace: { openSession: vi.fn() },
    get: () => ({ generation: { getSnapshot: () => 1, subscribe } }),
    slots: {
      inject: (_name: string, setup: () => void) => setup(),
      register: (options: { inject(): typeof props }) => {
        props = options.inject();
        return () => {};
      },
    },
  };
  apply(ctx as unknown as Context);
  if (!props) throw new Error("Settings not registered");
  const waiting = () => {
    status.set("one", { pendingInteraction: { kind: "question", key: "new" } });
    for (const listener of statusListeners) listener();
  };
  return { form, props, sent, FakeNotification, waiting, ctx, snapshot };
}

it("does nothing in Web clients and does not request notification permission", () => {
  const h = fixture();
  Reflect.deleteProperty(window, "dshDesktop");
  expect(() =>
    apply(
      new Proxy({} as Context, {
        get() {
          throw new Error("Unexpected service access");
        },
      }),
    ),
  ).not.toThrow();
  expect(h.FakeNotification.requestPermission).not.toHaveBeenCalled();
});

it("requests permission only from the explicit test action and closes the test on disposal", async () => {
  const h = fixture();
  expect(h.FakeNotification.requestPermission).not.toHaveBeenCalled();
  const pending = h.props.test();
  expect(h.FakeNotification.requestPermission).toHaveBeenCalledOnce();
  await pending;
  expect(h.form.set).toHaveBeenCalledWith("enabled", true);
  expect(h.sent[0].options.body).toBe(en.testBody);
  for (const stop of cleanups.splice(0).reverse()) stop();
  expect(h.sent[0].close).toHaveBeenCalledOnce();
  expect(h.sent[0].onclick).toBeNull();
});

it("does not re-request denied permission or change settings", async () => {
  const h = fixture("denied");
  await expect(h.props.test()).rejects.toThrow("permission");
  expect(h.FakeNotification.requestPermission).not.toHaveBeenCalled();
  expect(h.form.set).not.toHaveBeenCalled();
  expect(h.sent).toHaveLength(0);
});

it("does not deliver a pending permission response after disposal", async () => {
  const h = fixture();
  let settle: ((value: NotificationPermission) => void) | undefined;
  h.FakeNotification.requestPermission.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  const pending = h.props.test();
  for (const stop of cleanups.splice(0).reverse()) stop();
  settle?.("granted");
  await pending;
  expect(h.form.set).not.toHaveBeenCalled();
  expect(h.sent).toHaveLength(0);
});

it.each([
  ["visible", true, 0],
  ["visible", false, 1],
  ["hidden", true, 1],
] as const)("uses visibility=%s and focus=%s before delivery", (visibility, focused, count) => {
  const h = fixture("granted");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
  vi.spyOn(document, "hasFocus").mockReturnValue(focused);
  vi.spyOn(window, "focus").mockImplementation(() => {});
  h.waiting();
  expect(h.sent).toHaveLength(count);
  if (count) {
    h.sent[0].onclick?.();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(h.ctx.uiWorkspace.openSession).toHaveBeenCalledWith("one");
  }
});

it("renders native settings and persists the notification switch", async () => {
  const h = fixture("granted");
  render(
    <NotificationSettings form={h.form} permission={h.props.permission} test={h.props.test} t={(key) => en[key]} />,
  );
  expect(screen.getByRole("status").textContent).toBe(en.granted);
  fireEvent.click(screen.getByRole("checkbox", { name: en.enabled }));
  await waitFor(() => expect(h.form.set).toHaveBeenCalledWith("enabled", false));
});

it("shows a failed settings save and keeps the test button usable", async () => {
  const h = fixture("granted");
  vi.mocked(h.form.set).mockResolvedValue(false);
  render(
    <NotificationSettings form={h.form} permission={h.props.permission} test={h.props.test} t={(key) => en[key]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: en.test }));
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(h.sent).toHaveLength(0);
  expect((screen.getByRole("button", { name: en.test }) as HTMLButtonElement).disabled).toBe(false);
});
