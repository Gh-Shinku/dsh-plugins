/** Native DSH settings controls and the session customization modal. */

import {
  Button,
  Checkbox,
  IconChevronDownOutlineRegular,
  IconChevronRightOutlineRegular,
  Input,
  Menu,
  Modal,
} from "@deepseek-ai/dsh-client-ui-primitives";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { McpServerView, ProfileSnapshot } from "../contracts.ts";
import type { ManagerApi } from "./api.ts";
import { McpIcon } from "./icon.tsx";
import type { T } from "./locales.ts";
import { profileSummary, runtimeStatus } from "./presentation.ts";

export interface SurfaceProps {
  api: ManagerApi;
  t: T;
}

/** Shared native menu, including focus return, portal placement and selection indicators. */
export function ProfileMenu({
  profiles,
  value,
  label,
  disabled,
  customized,
  triggerLabel,
  servers,
  onOpen,
  unselected,
  onChange,
  t,
}: {
  profiles: ProfileSnapshot["profiles"];
  value: string;
  label?: string;
  disabled?: boolean;
  customized?: boolean;
  triggerLabel?: string;
  servers?: McpServerView[];
  onOpen?(): void;
  unselected?: boolean;
  onChange(id: string): void;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Menu
      open={open && !disabled}
      portal
      compact
      autoFocus
      minWidthFromAnchor
      anchor={
        <Button
          size="sm"
          variant="outline"
          aria-label={triggerLabel ?? t("profile")}
          aria-haspopup="menu"
          aria-expanded={open && !disabled}
          disabled={disabled}
          onClick={() => {
            if (!open) onOpen?.();
            setOpen(!open);
          }}
        >
          {triggerLabel ?? label ?? profiles.find((p) => p.id === value)?.name ?? t("none")}
          <IconChevronDownOutlineRegular size={14} />
        </Button>
      }
      selectedId={unselected ? undefined : customized ? "customize" : value ? `profile:${value}` : "none"}
      items={[
        { id: "none", label: t("none") },
        ...profiles.map((p) => ({
          id: `profile:${p.id}`,
          label: servers ? (
            <span className="shinku-mcp-profile-item">
              <span>{p.name}</span>
              <span className="shinku-mcp-meta">{profileSummary(p.servers, servers, t)}</span>
            </span>
          ) : (
            p.name
          ),
        })),
        ...(customized ? [{ id: "customize", label: t("custom"), disabled: true }] : []),
      ]}
      onClose={() => setOpen(false)}
      onSelect={(id) => {
        setOpen(false);
        if (id !== "customize") onChange(id === "none" ? "" : id.slice("profile:".length));
      }}
    />
  );
}

function Disclosure({
  label,
  children,
  forceOpen = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  forceOpen?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = expanded || forceOpen;
  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="shinku-mcp-disclosure"
        aria-expanded={open}
        onClick={() => setExpanded(!expanded)}
        icon={open ? <IconChevronDownOutlineRegular size={14} /> : <IconChevronRightOutlineRegular size={14} />}
      >
        {label}
      </Button>
      {open && <div className="shinku-mcp-children">{children}</div>}
    </div>
  );
}

/** Hierarchy browsing stays interactive when selection controls are read-only. */
export function ServerTree({
  servers,
  selected,
  onChange,
  disabled,
  inherited,
  statusUnknown,
  t,
}: {
  servers: McpServerView[];
  selected: string[];
  onChange?: (ids: string[]) => void;
  disabled?: boolean;
  inherited?: boolean;
  statusUnknown?: boolean;
  t: T;
}) {
  const [query, setQuery] = useState("");
  const q = query.toLocaleLowerCase();
  const visible = servers.filter(
    (s) =>
      `${s.serverName} ${s.id}`.toLocaleLowerCase().includes(q) ||
      s.tools.some((tool) => `${tool.name} ${tool.description}`.toLocaleLowerCase().includes(q)),
  );
  return (
    <div className="shinku-mcp-tree">
      <Input
        data-modal-autofocus
        aria-label={t("search")}
        placeholder={t("search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {servers.length === 0 && <p className="shinku-mcp-description">{t("noServers")}</p>}
      {servers.length > 0 && visible.length === 0 && <p className="shinku-mcp-description">{t("noResults")}</p>}
      {visible.map((server) => (
        <div className="shinku-mcp-server" key={server.id}>
          <div className="shinku-mcp-server-heading">
            {inherited || !onChange ? (
              <span>{server.serverName}</span>
            ) : (
              <Checkbox
                label={server.serverName}
                checked={selected.includes(server.id)}
                disabled={disabled || !onChange}
                onChange={(checked) =>
                  onChange?.(checked ? [...selected, server.id] : selected.filter((id) => id !== server.id))
                }
              />
            )}
            <span className="shinku-mcp-meta">
              {server.available
                ? `${server.tools.length} ${t(server.tools.length === 1 ? "tool" : "tools")}`
                : t("unavailable")}
            </span>
            <span className="shinku-mcp-status" data-state={statusUnknown ? "unknown" : runtimeStatus(server)}>
              {t(statusUnknown ? "statusUnknown" : runtimeStatus(server))}
            </span>
          </div>
          <Disclosure label={`${t("details")} · ${server.transport}`} forceOpen={!!q}>
            <p className="shinku-mcp-meta">{server.id}</p>
            {server.tools.length === 0 && <p className="shinku-mcp-description">{t("noTools")}</p>}
            {server.tools
              .filter(
                (tool) =>
                  !q ||
                  `${server.serverName} ${server.id}`.toLocaleLowerCase().includes(q) ||
                  `${tool.name} ${tool.description}`.toLocaleLowerCase().includes(q),
              )
              .map((tool) => (
                <Disclosure key={tool.name} label={tool.name} forceOpen={!!q} className="shinku-mcp-tool">
                  <p className="shinku-mcp-description">{tool.description}</p>
                  <p className="shinku-mcp-field-label">{t("schema")}</p>
                  <pre className="shinku-mcp-schema">{tool.parameterSchema}</pre>
                </Disclosure>
              ))}
          </Disclosure>
        </div>
      ))}
      {selected
        .filter((id) => !servers.some((s) => s.id === id))
        .map((id) =>
          onChange ? (
            <Checkbox
              key={id}
              label={`${id} · ${t("missing")}`}
              checked
              disabled={disabled || !onChange}
              onChange={() => onChange?.(selected.filter((s) => s !== id))}
            />
          ) : (
            <div className="shinku-mcp-server-heading" key={id}>
              <span>{id}</span>
              <span className="shinku-mcp-meta">{t("missing")}</span>
              <span className="shinku-mcp-status" data-state="disconnected">
                {t("disconnected")}
              </span>
            </div>
          ),
        )}
    </div>
  );
}

/** Profile edits stay staged until a revisioned native-settings save. */
export function ProfilesPage({ api, t }: SurfaceProps) {
  const nameId = useId();
  const [document, setDocument] = useState<ProfileSnapshot>();
  const [servers, setServers] = useState<McpServerView[]>([]);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string>();
  const epoch = useRef(0);
  const load = () => {
    const token = ++epoch.current;
    setError("");
    setBusy(true);
    void Promise.all([api.profiles(), api.catalog()])
      .then(([doc, rows]) => {
        if (epoch.current !== token) return;
        setDocument(doc);
        setServers(rows);
        setId((old) => (doc.profiles.some((p) => p.id === old) ? old : (doc.profiles[0]?.id ?? "")));
        setBusy(false);
      })
      .catch((e: Error) => {
        if (epoch.current === token) {
          setError(e.message);
          setBusy(false);
        }
      });
  };
  useEffect(() => {
    load();
    return () => {
      ++epoch.current;
    };
  }, [api]);
  const profile = document?.profiles.find((p) => p.id === id);
  const update = (patch: Partial<NonNullable<typeof profile>>) => {
    if (document)
      setDocument({ ...document, profiles: document.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };
  const add = (copy = false) => {
    if (!document) return;
    const next = {
      id: crypto.randomUUID(),
      name: copy && profile ? `${profile.name} (2)` : t("newProfile"),
      servers: copy && profile ? [...profile.servers] : [],
    };
    setDocument({ ...document, profiles: [...document.profiles, next] });
    setId(next.id);
  };
  const save = async () => {
    if (!document || busy) return;
    if (document.profiles.some((p) => !p.name.trim())) {
      setError(t("emptyName"));
      return;
    }
    const token = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveProfiles(
        { profiles: document.profiles, defaultProfileId: document.defaultProfileId },
        document.revision,
      );
      if (epoch.current === token) setDocument(saved);
    } catch (e) {
      if (epoch.current === token) setError(e instanceof Error ? e.message : t("error"));
    } finally {
      if (epoch.current === token) setBusy(false);
    }
  };
  return (
    <section className="shinku-mcp" aria-label={t("title")}>
      <h2 className="shinku-mcp-title">
        <McpIcon size={18} />
        {t("title")}
      </h2>
      {error && (
        <div role="alert" className="shinku-mcp-error">
          {error}
          <Button size="sm" onClick={load}>
            {t("retry")}
          </Button>
        </div>
      )}
      {!document ? (
        <p className="shinku-mcp-description">{t("loading")}</p>
      ) : (
        <>
          <div className="shinku-mcp-actions">
            <ProfileMenu t={t} profiles={document.profiles} value={id} disabled={busy} onChange={setId} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => add()}>
              {t("newProfile")}
            </Button>
            <Button size="sm" disabled={busy || !profile} onClick={() => add(true)}>
              {t("duplicate")}
            </Button>
          </div>
          {profile && (
            <>
              <label className="shinku-mcp-field-label" htmlFor={nameId}>
                {t("name")}
                <Input
                  id={nameId}
                  value={profile.name}
                  disabled={busy}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <Checkbox
                label={t("default")}
                checked={document.defaultProfileId === id}
                disabled={busy}
                onChange={(checked) => setDocument({ ...document, defaultProfileId: checked ? id : "" })}
              />
              <ServerTree
                t={t}
                servers={servers}
                selected={profile.servers}
                disabled={busy}
                onChange={(servers) => update({ servers })}
              />
              <Button size="sm" disabled={busy} onClick={() => setDeleting(id)}>
                {t("remove")}
              </Button>
            </>
          )}
          {!profile && <ServerTree t={t} servers={servers} selected={[]} />}
          <div className="shinku-mcp-actions">
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              {busy ? t("loading") : t("save")}
            </Button>
            <Button size="sm" disabled={busy} onClick={load}>
              {t("cancel")}
            </Button>
          </div>
        </>
      )}
      <Modal
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        title={t("remove")}
        closeLabel={t("close")}
        description={t("confirmDelete")}
        footer={
          <>
            <Button size="sm" onClick={() => setDeleting(undefined)}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (document) {
                  setDocument({
                    ...document,
                    profiles: document.profiles.filter((p) => p.id !== deleting),
                    defaultProfileId: document.defaultProfileId === deleting ? "" : document.defaultProfileId,
                  });
                  if (id === deleting) setId("");
                }
                setDeleting(undefined);
              }}
            >
              {t("remove")}
            </Button>
          </>
        }
      />
    </section>
  );
}
