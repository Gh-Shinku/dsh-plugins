/** Compact status, read-only inspection, and staged editing are separate interactions. */
import {
  Button,
  IconCloseOutlineRegular,
  IconRefreshOutlineRegular,
  Modal,
} from "@deepseek-ai/dsh-client-ui-primitives";
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
      <McpIcon size={16} />
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
      headless
      className="shinku-mcp-dialog"
    >
      <header className="shinku-mcp-dialog-header">
        <h2>{t(editing ? "customizeSession" : "inspector")}</h2>
        <Button
          size="sm"
          className="shinku-mcp-dialog-close"
          aria-label={t("close")}
          disabled={saving}
          onClick={dismiss}
        >
          <IconCloseOutlineRegular size={14} />
        </Button>
      </header>
      <div className="shinku-mcp-dialog-content">
        <div className="shinku-mcp shinku-mcp-session" ref={body}>
          {errors.map((message) => (
            <div className="shinku-mcp-error" role="alert" key={message}>
              {message}
              <Button
                size="sm"
                variant="outline"
                className="shinku-mcp-secondary"
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
                <div className="shinku-mcp-summary-content">
                  <div className="shinku-mcp-summary-name">
                    <McpIcon size={16} />
                    <strong>{name}</strong>
                    {modified && <span className="shinku-mcp-tag">{t("modified")}</span>}
                  </div>
                  <div className="shinku-mcp-summary-details">
                    <span className="shinku-mcp-meta">{t(editing ? "sessionOnly" : "currentSession")}</span>
                    {!editing && health && health.total > 0 && (
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
                </div>
                {editing && draft && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shinku-mcp-secondary"
                    disabled={saving || (!!draft.profileId && !template)}
                    onClick={controller.resetDraft}
                  >
                    {t("reset")}
                  </Button>
                )}
              </div>
              {editing ? (
                draft ? (
                  <ServerTree
                    t={t}
                    servers={servers}
                    selected={draft.servers}
                    disabled={saving}
                    statusUnknown={!!statusError}
                    onChange={controller.editServers}
                  />
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="shinku-mcp-secondary"
                      disabled={saving || !!statusError}
                      onClick={controller.customize}
                    >
                      {t("customize")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shinku-mcp-secondary"
                      icon={<IconRefreshOutlineRegular size={16} />}
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
                    <p className="shinku-mcp-empty">{t("noSelected")}</p>
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
      </div>
      <footer className="shinku-mcp-dialog-footer">
        {editing ? (
          <>
            <Button variant="outline" className="shinku-mcp-secondary" disabled={saving} onClick={controller.close}>
              {t("cancel")}
            </Button>
            <Button
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
          <Button variant="outline" className="shinku-mcp-secondary" onClick={controller.close}>
            {t("close")}
          </Button>
        )}
      </footer>
    </Modal>
  );
}
