/** Desktop-only adapter; host services never enter the browser bundle. */
import type { Context } from "@deepseek-ai/cordis";
import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";
import type {} from "@deepseek-ai/dsh-api-session-controller/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-session/client";
import type {} from "@deepseek-ai/dsh-client-ui-workspace/client";
import remoteInfo from "@shinku-ever/dsh-desktop-notifications/remote";
import { NotificationController } from "./controller.ts";
import { en, type LocaleKey, zh } from "./locales.ts";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "shinku.desktopNotifications": LocaleKey;
  }
}

export const inject = ["locale", "sessions", "uiSession", "uiWorkspace", "connection", "remote"];

export function isDesktop(): boolean {
  const bridge = (window as Window & { dshDesktop?: { protocolVersion?: number } }).dshDesktop;
  return bridge?.protocolVersion === 1;
}

export async function apply(ctx: Context): Promise<void> {
  if (!isDesktop()) return;
  const unmount = await ctx.remote.$mount(remoteInfo);
  ctx.effect(() => unmount);
  ctx.inject(["remote.shinkuDesktopNotifications"], mountNotifications);
}

function mountNotifications(ctx: Context): void {
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
  const permission = () => (typeof Notification === "undefined" ? ("unsupported" as const) : Notification.permission);
  const foreground = () => document.visibilityState === "visible" && document.hasFocus();
  const all = new Set<Notification>();
  const show = (title: string, body: string, click: () => void) => {
    // Session replacement is owned by the controller; avoid native platform tag constraints.
    const notice = new Notification(title, { body });
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
        ctx.uiWorkspace.openSession(id);
        window.focus();
        void ctx.remote.shinkuDesktopNotifications
          .activate()
          .then((result) => {
            if (!result.ok) throw new Error(result.error.message);
          })
          .catch((error: unknown) => {
            console.warn("[desktop-notifications] Could not activate the desktop window", error);
          });
      },
      text: t,
      warn: (error) => {
        console.warn("[desktop-notifications] Notification observation or delivery unavailable", error);
      },
    },
  );
  let active = true;
  controller.setEnabled(true);
  if (permission() === "default") {
    // Desktop owns its permission handler. Installing the plugin enables it immediately.
    void (async () => {
      try {
        const result = await Notification.requestPermission();
        if (active && result !== "granted")
          console.warn("[desktop-notifications] System notification permission unavailable");
      } catch {
        if (active) console.warn("[desktop-notifications] System notification permission unavailable");
      }
    })();
  }
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
