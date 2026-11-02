/** Desktop-only adapter; host services never enter the browser bundle. */
import type { Context } from "@deepseek-ai/cordis";
import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";
import type {} from "@deepseek-ai/dsh-api-session-controller/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-session/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type {} from "@deepseek-ai/dsh-client-ui-workspace/client";
import { NotificationController } from "./controller.ts";
import { en, type LocaleKey, zh } from "./locales.ts";
import { NotificationSettings, type Preferences } from "./settings.tsx";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "shinku.desktopNotifications": LocaleKey;
  }
}

export const inject = ["slots", "locale", "sessions", "uiSession", "uiWorkspace", "configForms", "connection"];

export function isDesktop(): boolean {
  const bridge = (window as Window & { dshDesktop?: { protocolVersion?: number } }).dshDesktop;
  return bridge?.protocolVersion === 1;
}

export function apply(ctx: Context): void {
  if (!isDesktop()) return;
  ctx.effect(() => {
    const stops = [
      ctx.locale.register("shinku.desktopNotifications", "en", en),
      ctx.locale.register("shinku.desktopNotifications", "zh", zh),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  });
  const t = ctx.locale.bind("shinku.desktopNotifications");
  const form = ctx.configForms.get<Preferences>("shinku-desktop-notifications");
  const permission = () => (typeof Notification === "undefined" ? ("unsupported" as const) : Notification.permission);
  const foreground = () => document.visibilityState === "visible" && document.hasFocus();
  const all = new Set<Notification>();
  const show = (title: string, body: string, tag: string, click: () => void) => {
    const notice = new Notification(title, { body, tag });
    all.add(notice);
    notice.onclick = () => click();
    notice.onclose = () => {
      all.delete(notice);
    };
    notice.onerror = () => {
      console.warn("[desktop-notifications] System notification delivery failed");
    };
    return {
      close: () => {
        notice.onclick = null;
        notice.onclose = null;
        notice.onerror = null;
        all.delete(notice);
        notice.close();
      },
    };
  };
  const controller = new NotificationController(
    ctx.sessions,
    ctx.uiSession.sessionStatus,
    (ctx.get("connection") as ConnectionHandle).generation,
    {
      foreground,
      allowed: () => permission() === "granted",
      show,
      open: (id) => {
        window.focus();
        ctx.uiWorkspace.openSession(id);
      },
      text: t,
      warn: () => {
        console.warn("[desktop-notifications] Notification observation or delivery unavailable");
      },
    },
  );
  const sync = () => {
    const snapshot = form.getSnapshot();
    controller.setEnabled(snapshot.status === "ready" && snapshot.value?.enabled === true);
  };
  ctx.effect(() => form.subscribe(sync));
  sync();
  let active = true;
  const test = async () => {
    // Must precede any await that could lose the click's user activation.
    const result = permission() === "default" ? await Notification.requestPermission() : permission();
    if (!active) return;
    if (result !== "granted") throw new Error("Notification permission unavailable");
    if (!(await form.set("enabled", true))) throw new Error("Notification preference could not be saved");
    if (!active) return;
    show(t("title"), t("testBody"), "dsh-desktop-notifications:test", () => window.focus());
  };
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "shinku-desktop-notifications",
        order: 26,
        label: () => t("title"),
        locale: "shinku.desktopNotifications",
        inject: () => ({ form, permission, test }),
      },
      NotificationSettings,
    ),
  );
  ctx.effect(() => {
    window.addEventListener("focus", controller.acknowledge);
    document.addEventListener("visibilitychange", controller.acknowledge);
    return () => {
      active = false;
      window.removeEventListener("focus", controller.acknowledge);
      document.removeEventListener("visibilitychange", controller.acknowledge);
      controller.dispose();
      for (const notice of all) {
        notice.onclick = null;
        notice.onclose = null;
        notice.onerror = null;
        notice.close();
      }
      all.clear();
    };
  });
}
