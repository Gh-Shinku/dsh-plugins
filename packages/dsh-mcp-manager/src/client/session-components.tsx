/** Compact status, read-only inspection, and staged editing are separate interactions. */
import { Button, Modal } from "@deepseek-ai/dsh-client-ui-primitives";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ProfileMenu, ServerTree } from "./components.tsx";
import { McpIcon } from "./icon.tsx";
import type { T } from "./locales.ts";
import { isModified, selectionName, sessionHealth } from "./presentation.ts";
import type { McpSessionController } from "./session-controller.ts";

interface SessionProps {
  controller: McpSessionController;
  t: T;
}

export function SessionIndicator({ controller, t }: SessionProps) {
  const { view, profiles, servers, statusError, saving } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => controller.watch(), [controller]);
  const name = view ? selectionName(view, profiles, t) : t("commandLabel");
  const modified = view && isModified(view, profiles);
  const health = view && sessionHealth(view, servers);
  const summary = saving
    ? t("saving")
    : statusError
      ? t("statusUnknown")
      : health
        ? health.total
          ? `${health.ready}/${health.total} ${t("ready")}`
          : `0 ${t("mcps")}`
        : t("loading");
  const state = statusError
    ? "unknown"
    : health?.errors
      ? "runtimeError"
      : health && health.total > health.ready
        ? "disconnected"
        : health?.total
          ? "ready"
          : "unknown";
  return (
    <Button
      size="sm"
      variant="ghost"
      className="shinku-mcp-indicator"
      aria-label={["MCP", name, modified && t("modified"), summary].filter(Boolean).join(" · ")}
      aria-haspopup="dialog"
      onClick={() => controller.deferOpen("inspect")}
    >
      <McpIcon size={14} />
      <span className="shinku-mcp-indicator-name">{name}</span>
      {modified && <span className="shinku-mcp-tag">{t("modified")}</span>}
      <span className="shinku-mcp-status" data-state={state}>
        {summary}
      </span>
    </Button>
  );
}

/** One native modal preserves focus return while its body switches between inspection and editing. */
export function SessionCustomization({ controller, t }: SessionProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.close(), [controller]);
  useEffect(() => {
    if (state.open && state.view) body.current?.querySelector<HTMLElement>("[data-modal-autofocus]")?.focus();
  }, [state.open, state.mode, state.draft !== undefined, state.view !== undefined]);
  const { view, profiles, servers, draft, saving, loading, error, statusError } = state;
  const editing = state.mode === "customize";
  const draftView = view && draft ? { ...view, legacy: false, selection: draft } : view;
  const name = draftView ? selectionName(draftView, profiles, t) : t("commandLabel");
  const modified = draftView && isModified(draftView, profiles);
  const template = profiles?.profiles.find((profile) => profile.id === draft?.profileId);
  const health = view && sessionHealth(view, servers);
  const visible = view?.legacy ? servers : servers.filter((server) => view?.selection.servers.includes(server.id));
  const errors = [error, statusError].filter((message, i, all) => message && all.indexOf(message) === i);
  const dismiss = () => {
    if (!saving) controller.close();
  };
  return (
    <Modal
      open={state.open}
      onClose={dismiss}
      title={t(editing ? "customizeSession" : "inspector")}
      closeLabel={t("close")}
      className="shinku-mcp-dialog"
      contentClassName="shinku-mcp-dialog-content"
      footer={
        editing ? (
          <>
            <Button size="sm" disabled={saving} onClick={controller.close}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={saving || !draft || !!statusError}
              onClick={() => {
                void controller.applyDraft().catch(() => {});
              }}
            >
              {saving ? t("saving") : t("apply")}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={controller.close}>
            {t("close")}
          </Button>
        )
      }
    >
      <div className="shinku-mcp" ref={body}>
        {errors.map((message) => (
          <div className="shinku-mcp-error" role="alert" key={message}>
            {message}
            <Button
              size="sm"
              disabled={saving}
              onClick={() => {
                void controller.load();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ))}
        {loading || !view || !profiles ? (
          <p className="shinku-mcp-description">{t("loading")}</p>
        ) : (
          <>
            <div className="shinku-mcp-summary">
              <div className="shinku-mcp-summary-name">
                <McpIcon size={18} />
                <strong>{name}</strong>
                {modified && <span className="shinku-mcp-tag">{t("modified")}</span>}
              </div>
              <span className="shinku-mcp-meta">{t(editing ? "sessionOnly" : "currentSession")}</span>
              {!editing && health && (
                <div className="shinku-mcp-health">
                  {statusError ? (
                    t("statusUnknown")
                  ) : (
                    <>
                      <span>
                        {health.ready} {t("ready")}
                      </span>
                      <span>
                        {health.total - health.ready - health.errors} {t("disconnected")}
                      </span>
                      {health.errors > 0 && (
                        <span>
                          {health.errors} {t("runtimeError")}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            {editing ? (
              draft ? (
                <>
                  <div className="shinku-mcp-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving || (!!draft.profileId && !template)}
                      onClick={controller.resetDraft}
                    >
                      {t("reset")}
                    </Button>
                  </div>
                  <ServerTree
                    t={t}
                    servers={servers}
                    selected={draft.servers}
                    disabled={saving}
                    statusUnknown={!!statusError}
                    onChange={controller.editServers}
                  />
                </>
              ) : (
                <p className="shinku-mcp-description">{t("loading")}</p>
              )
            ) : (
              <>
                <div className="shinku-mcp-actions">
                  <ProfileMenu
                    t={t}
                    profiles={profiles.profiles}
                    value={view.selection.profileId}
                    customized={!!modified}
                    unselected={view.legacy}
                    triggerLabel={t("switchProfile")}
                    servers={servers}
                    disabled={saving}
                    onOpen={() => {
                      void controller.load(true);
                    }}
                    onChange={(id) => {
                      void controller.applyProfile(id).catch(() => {});
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={saving || !!statusError} onClick={controller.customize}>
                    {t("customize")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving || loading}
                    onClick={() => {
                      void controller.load();
                    }}
                  >
                    {t("refresh")}
                  </Button>
                </div>
                {view.legacy && <p className="shinku-mcp-description">{t("legacy")}</p>}
                {health?.total === 0 ? (
                  <p className="shinku-mcp-description">{t("noSelected")}</p>
                ) : (
                  <ServerTree
                    t={t}
                    servers={visible}
                    selected={view.legacy ? servers.map((server) => server.id) : view.selection.servers}
                    statusUnknown={!!statusError}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
