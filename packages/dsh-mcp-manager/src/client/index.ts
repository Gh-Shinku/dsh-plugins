/** Native UI registrations; transport adaptation lives here, outside React views. */
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type {} from "@deepseek-ai/dsh-api-session-controller/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-commands/client";
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-session/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import remoteInfo from "@shinku-ever/dsh-mcp-manager/remote";
import type { ManagerApi } from "./api.ts";
import { ProfilesPage } from "./components.tsx";
import type { LocaleKey } from "./locales.ts";
import { en, zh } from "./locales.ts";
import { SessionCustomization, SessionIndicator } from "./session-components.tsx";
import { McpSessionController, mcpCommand } from "./session-controller.ts";
import { styles } from "./styles.ts";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "shinku.mcpManager": LocaleKey;
  }
}

export const inject = ["slots", "locale", "remote", "sessions", "conversation", "commandUi"];

/** Install reversible native settings and chatbox contributions. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(remoteInfo);
  ctx.effect(() => unmount);
  ctx.inject(["remote.shinkuMcpManager"], mountUi);
}

function mountUi(ctx: Context): void {
  ctx.effect(() => {
    const stops = [
      ctx.locale.register("shinku.mcpManager", "en", en),
      ctx.locale.register("shinku.mcpManager", "zh", zh),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  });
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "@shinku-ever/dsh-mcp-manager";
    style.textContent = styles;
    document.head.append(style);
    return () => {
      style.remove();
    };
  });
  const unwrap = async <T>(response: Promise<RemoteResult<T>>): Promise<T> => {
    const result = await response;
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const pending = new Map<string, Promise<unknown>>();
  const ownedBlocks = new Map<
    string,
    { binding: ReturnType<Context["sessions"]["binding"]>; block: { reason: string } }
  >();
  let active = true;
  const releaseBlock = (id: string) => {
    const owned = ownedBlocks.get(id);
    ownedBlocks.delete(id);
    if (!owned) return;
    const sessionId = id as SessionId;
    if (
      ctx.sessions.binding(sessionId) === owned.binding &&
      ctx.conversation.blocks.storeFor(sessionId).getSnapshot() === owned.block
    )
      ctx.conversation.blocks.set(sessionId, undefined);
  };
  ctx.effect(() => () => {
    active = false;
    for (const id of ownedBlocks.keys()) releaseBlock(id);
  });
  const api: ManagerApi = {
    profiles: () => unwrap(ctx.remote.shinkuMcpManager.profiles()),
    saveProfiles: (doc, rev) => unwrap(ctx.remote.shinkuMcpManager.saveProfiles(doc, rev)),
    catalog: (id) =>
      unwrap(id ? ctx.remote.shinkuMcpManager.sessionCatalog(id) : ctx.remote.shinkuMcpManager.catalog()),
    selection: (id) => unwrap(ctx.remote.shinkuMcpManager.selection(id)),
    select: (id, selection) => {
      const sessionId = id as SessionId;
      const binding = ctx.sessions.binding(sessionId);
      const block = { reason: ctx.locale.bind("shinku.mcpManager")("loading") };
      const blocks = ctx.conversation.blocks;
      const existing = blocks.storeFor(sessionId).getSnapshot();
      if (!existing) {
        blocks.set(sessionId, block);
        ownedBlocks.set(id, { binding, block });
      }
      const operation = (pending.get(id) ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => {
          if (!active || ctx.sessions.binding(sessionId) !== binding)
            throw new Error(ctx.locale.bind("shinku.mcpManager")("sessionChanged"));
          return unwrap(ctx.remote.shinkuMcpManager.select(id, selection));
        });
      const completion = operation.finally(() => {
        if (pending.get(id) === completion) {
          pending.delete(id);
          if (active) releaseBlock(id);
        }
      });
      pending.set(id, completion);
      return completion;
    },
  };
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "shinku-mcp-profiles",
        order: 25,
        label: () => ctx.locale.bind("shinku.mcpManager")("title"),
        locale: "shinku.mcpManager",
        inject: () => ({ api }),
      },
      ProfilesPage,
    ),
  );
  const controllers = new Map<
    string,
    { binding: ReturnType<Context["sessions"]["binding"]>; controller: McpSessionController; stop: () => Promise<void> }
  >();
  const t = ctx.locale.bind("shinku.mcpManager");
  const controllerFor = (id: string): McpSessionController => {
    const sessionId = id as SessionId;
    const binding = ctx.sessions.binding(sessionId);
    if (!binding) throw new Error(t("sessionChanged"));
    const existing = controllers.get(id);
    if (existing?.binding === binding) return existing.controller;
    existing?.controller.dispose();
    if (existing) void existing.stop();
    const controller = new McpSessionController(
      api,
      id,
      t,
      () => active && ctx.sessions.binding(sessionId) === binding,
    );
    const stop = binding.ctx.effect(() => {
      const retained = ctx.sessions.retainInfo(sessionId);
      controller.setVisible(!!retained.getSnapshot().retainedBy.mainView);
      const unsubscribe = retained.subscribe(() => {
        controller.setVisible(!!retained.getSnapshot().retainedBy.mainView);
      });
      return () => {
        unsubscribe();
        controller.dispose();
        if (controllers.get(id)?.controller === controller) controllers.delete(id);
      };
    });
    controllers.set(id, { binding, controller, stop });
    return controller;
  };
  ctx.effect(() => () => {
    ctx.commandUi.dismiss("mcp");
    return Promise.all(
      [...controllers.values()].map(async ({ controller, stop }) => {
        controller.dispose();
        await stop();
      }),
    ).then(() => {
      controllers.clear();
    });
  });
  ctx.effect(() =>
    ctx.commandUi.register(
      mcpCommand(
        controllerFor,
        t,
        (id) =>
          ctx.sessions.binding(id as SessionId) !== undefined &&
          ctx.sessions.subagentAddress(id as SessionId) === undefined,
      ),
    ),
  );
  ctx.slots.inject("conversation.input.overlay", () =>
    ctx.slots.register(
      {
        name: "conversation.input.overlay",
        id: "shinku-mcp-customization",
        order: 5,
        locale: "shinku.mcpManager",
        inject: (sessionId) => ({ controller: controllerFor(sessionId) }),
      },
      SessionCustomization,
    ),
  );
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "shinku-mcp-status",
        order: 20,
        locale: "shinku.mcpManager",
        inject: (sessionId) => ({ controller: controllerFor(sessionId) }),
      },
      SessionIndicator,
    ),
  );
}

export type { ManagerApi } from "./api.ts";
export type { SurfaceProps } from "./components.tsx";
export { ProfilesPage } from "./components.tsx";
export type { LocaleKey } from "./locales.ts";
export { SessionCustomization, SessionIndicator } from "./session-components.tsx";
