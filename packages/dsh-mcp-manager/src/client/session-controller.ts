/** Shared session state, with independent read, write and surface lifetimes. */
import type { CommandContribution, SelectOption } from "@deepseek-ai/dsh-client-ui-commands/client";
import type { McpServerView, ProfileSnapshot, SelectionView, SessionSelection } from "../contracts.ts";
import type { ManagerApi } from "./api.ts";
import { McpIcon } from "./icon.tsx";
import type { T } from "./locales.ts";
import { profileSummary, sameServers } from "./presentation.ts";

export { sameServers } from "./presentation.ts";

export interface SessionUiState {
  open: boolean;
  mode: "inspect" | "customize";
  loading: boolean;
  saving: boolean;
  error: string;
  statusError: string;
  view?: SelectionView;
  profiles?: ProfileSnapshot;
  servers: McpServerView[];
  draft?: SessionSelection;
}

export class McpSessionController {
  private state: SessionUiState = {
    open: false,
    mode: "inspect",
    loading: false,
    saving: false,
    error: "",
    statusError: "",
    servers: [],
  };
  private listeners = new Set<() => void>();
  private disposed = false;
  private read = 0;
  private surface = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setTimeout>;
  private watchEpoch = 0;
  private watchers = 0;
  private visible = true;
  constructor(
    private readonly api: ManagerApi,
    readonly sessionId: string,
    private readonly t: T,
    private readonly isCurrent: () => boolean = () => true,
  ) {}

  getSnapshot = (): SessionUiState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private valid(): boolean {
    return !this.disposed && this.isCurrent();
  }
  private publish(patch: Partial<SessionUiState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private patch(patch: Partial<SessionUiState>): void {
    if (this.valid()) this.publish(patch);
  }
  private message(error: unknown): string {
    return error instanceof Error ? error.message : this.t("error");
  }

  /** All native entry points stay focused on choosing configuration, including during chats. */
  async options(signal: AbortSignal): Promise<SelectOption[]> {
    signal.throwIfAborted();
    await this.load();
    signal.throwIfAborted();
    if (!this.valid()) throw new Error(this.t("sessionChanged"));
    const { view, profiles, servers, error } = this.state;
    if (!view || !profiles || error) throw new Error(error || this.t("error"));
    const matched = profiles.profiles.find(
      (p) => p.id === view.selection.profileId && sameServers(p.servers, view.selection.servers),
    );
    const none = !view.legacy && !view.selection.profileId && !view.selection.servers.length;
    return [
      { id: "none", label: this.t("none"), active: none, detail: profileSummary([], servers, this.t) },
      ...profiles.profiles.map((p) => ({
        id: `profile:${p.id}`,
        label: p.name,
        detail: profileSummary(p.servers, servers, this.t),
        active: !view.legacy && p === matched,
      })),
      { id: "customize", label: this.t("customize"), active: !none && !matched && !view.legacy },
    ];
  }

  /** Defer until the native command picker has consumed its token and returned composer focus. */
  deferOpen(mode: SessionUiState["mode"] = "customize"): void {
    if (!this.valid()) return;
    this.close();
    const surface = this.surface;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.valid() || surface !== this.surface) return;
      this.patch({ open: true, mode, error: "", draft: undefined });
      void this.load().then(() => {
        if (mode === "customize" && surface === this.surface && this.state.open && !this.state.draft) this.seedDraft();
      });
    }, 0);
  }

  /** Switch from inspection to a detached draft; selection changes only on Apply. */
  customize = (): void => {
    if (!this.valid() || !this.state.view || this.state.saving) return;
    ++this.surface;
    this.patch({ open: true, mode: "customize", error: "" });
    this.seedDraft();
  };
  private seedDraft(): void {
    const { view, servers } = this.state;
    if (!view || (view.legacy && this.state.statusError)) return;
    this.patch({
      draft: view.legacy
        ? { version: 1, profileId: "", profileName: "", servers: servers.map((server) => server.id) }
        : { ...view.selection, servers: [...view.selection.servers] },
    });
  }
  editServers = (servers: string[]): void => {
    if (!this.state.saving && this.state.draft) this.patch({ draft: { ...this.state.draft, servers: [...servers] } });
  };
  resetDraft = (): void => {
    const draft = this.state.draft;
    if (!draft || this.state.saving) return;
    const profile = this.state.profiles?.profiles.find((p) => p.id === draft.profileId);
    if (!draft.profileId || profile) this.editServers(profile?.servers ?? []);
  };
  async applyDraft(): Promise<void> {
    const draft = this.state.draft;
    if (!draft) return;
    const surface = this.surface;
    await this.save({ ...draft, servers: [...draft.servers] });
    if (surface === this.surface) this.close();
  }

  /** Quiet refreshes never replace an editing draft or invalidate a pending write. */
  async load(quiet = false): Promise<void> {
    if (!this.valid() || this.state.saving) return;
    const read = ++this.read;
    this.patch({ loading: !quiet && !this.state.view, ...(quiet ? {} : { error: "" }) });
    try {
      const [view, profiles, catalog] = await Promise.all([
        this.api.selection(this.sessionId),
        this.api.profiles(),
        this.api.catalog(this.sessionId).then(
          (servers) => ({ servers, error: "" }),
          (error: unknown) => ({ servers: undefined, error: this.message(error) }),
        ),
      ]);
      if (read !== this.read) return;
      this.patch({
        view,
        profiles,
        ...(catalog.servers ? { servers: catalog.servers } : {}),
        statusError: catalog.error,
        loading: false,
      });
      if (this.state.open && this.state.mode === "customize" && !this.state.draft) this.seedDraft();
    } catch (error) {
      if (read === this.read)
        this.patch({ loading: false, error: this.message(error), statusError: this.message(error) });
    }
  }

  async applyProfile(id: string): Promise<void> {
    await this.writeSelection(async () => {
      const profiles = await this.api.profiles();
      if (!this.valid()) throw new Error(this.t("sessionChanged"));
      const profile = profiles.profiles.find((p) => p.id === id);
      if (id && !profile) throw new Error(this.t("profileUnavailable"));
      this.patch({ profiles });
      return {
        version: 1,
        profileId: profile?.id ?? "",
        profileName: profile?.name ?? "",
        servers: [...(profile?.servers ?? [])],
      };
    });
  }
  async save(selection: SessionSelection): Promise<void> {
    await this.writeSelection(async () => selection);
  }
  private async writeSelection(prepare: () => Promise<SessionSelection>): Promise<void> {
    if (!this.valid()) throw new Error(this.t("sessionChanged"));
    if (this.state.saving) throw new Error(this.t("saving"));
    ++this.read;
    this.patch({ saving: true, error: "" });
    try {
      const selection = await prepare();
      if (!this.valid()) throw new Error(this.t("sessionChanged"));
      const view = await this.api.select(this.sessionId, selection);
      this.patch({ view, saving: false });
    } catch (error) {
      this.patch({ saving: false, error: this.message(error) });
      throw error;
    }
  }

  /** Reference-counted refreshes belong only to visible composer indicators. */
  watch(): () => void {
    ++this.watchers;
    if (this.watchers === 1) {
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.refreshVisible);
      if (typeof window !== "undefined") window.addEventListener("focus", this.refreshVisible);
      this.refreshVisible();
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.watchers === 0) this.stopWatching();
    };
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!visible) {
      clearTimeout(this.poll);
      this.close();
    } else this.refreshVisible();
  }
  private refreshVisible = (): void => {
    const epoch = ++this.watchEpoch;
    clearTimeout(this.poll);
    if (!this.watchers || !this.visible || !this.valid()) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void this.load(true).finally(() => {
      if (epoch === this.watchEpoch && this.watchers && this.visible && this.valid())
        this.poll = setTimeout(this.refreshVisible, 15_000);
    });
  };
  private stopWatching(): void {
    ++this.watchEpoch;
    clearTimeout(this.poll);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.refreshVisible);
    if (typeof window !== "undefined") window.removeEventListener("focus", this.refreshVisible);
  }
  close = (): void => {
    clearTimeout(this.timer);
    this.timer = undefined;
    ++this.surface;
    ++this.read;
    this.publish({ open: false, loading: false, draft: undefined });
  };
  dispose(): void {
    if (this.disposed) return;
    this.close();
    this.disposed = true;
    this.stopWatching();
    this.listeners.clear();
  }
}

export function mcpCommand(
  resolve: (id: string) => McpSessionController,
  t: T,
  available: (id: string) => boolean,
): CommandContribution {
  return {
    name: "mcp",
    label: () => t("commandLabel"),
    icon: McpIcon,
    description: () => t("commandDescription"),
    available: (session) => available(session.sessionId),
    ui: {
      kind: "popupSelect",
      searchMode: "substring",
      searchLabels: () => ({ placeholder: t("profileSearch"), empty: t("noProfiles"), noResults: t("noResults") }),
      options: (session, signal) => resolve(session.sessionId).options(signal),
      onSelect: (option, session) =>
        option.id === "customize"
          ? resolve(session.sessionId).deferOpen()
          : resolve(session.sessionId).applyProfile(option.id === "none" ? "" : option.id.slice("profile:".length)),
    },
  };
}
