/** Real-time notification policy over native session sources. No approval decisions live here. */
import type {
  ISessions,
  SessionEventWindow,
  SessionReference,
  SessionSummary,
} from "@deepseek-ai/dsh-api-session-controller/client";
import type { SessionStatusSnapshot } from "@deepseek-ai/dsh-client-ui-session/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";

declare module "@deepseek-ai/dsh-api-session-controller/client" {
  interface SessionReferenceSourceMap {
    desktopNotifications: unknown;
  }
}

export interface Source<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}
export type NoticeKind = "completed" | "failed" | "waiting";
export interface Notice {
  close(): void;
}
export interface NotificationEnvironment {
  foreground(): boolean;
  allowed(): boolean;
  show(title: string, body: string, click: () => void): Notice;
  open(id: SessionId): void;
  text(key: NoticeKind | "fallback"): string;
  warn(error: unknown): void;
}
interface Watch {
  reference: SessionReference;
  stop: () => void;
  revision: number;
  sequence: number;
  inTurn: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export class NotificationController {
  private watches = new Map<SessionId, Watch>();
  private notices = new Map<SessionId, Notice>();
  private interactions = new Map<SessionId, Set<string>>();
  private stops: (() => void)[] = [];
  private enabled = false;
  private active = true;
  private epoch = 0;
  private generation: unknown;
  private resetting = false;
  private acquiring = new Set<SessionId>();
  private failed = new Set<SessionId>();

  constructor(
    private readonly sessions: Pick<ISessions, "list" | "retain">,
    private readonly status: Source<SessionStatusSnapshot>,
    connection: Source<unknown>,
    private readonly env: NotificationEnvironment,
  ) {
    this.generation = connection.getSnapshot();
    this.stops.push(
      connection.subscribe(() => {
        const next = connection.getSnapshot();
        if (next === this.generation) return;
        this.reset();
        this.generation = next;
        this.seedInteractions();
        this.reconcile();
      }),
      sessions.list.subscribe(() => this.reconcile()),
      status.subscribe(() => this.observeInteractions()),
    );
  }

  setEnabled(enabled: boolean): void {
    if (!this.active || enabled === this.enabled) return;
    this.reset();
    this.enabled = enabled;
    this.seedInteractions();
    this.reconcile();
  }

  private seedInteractions(): void {
    for (const [id, state] of this.status.getSnapshot()) {
      const interaction = state.pendingInteraction;
      if (interaction) this.rememberInteraction(id, `${interaction.kind}:${interaction.key}`);
    }
  }

  private observeInteractions(): void {
    if (!this.active || this.resetting || !this.enabled || this.generation === undefined) return;
    this.reconcile();
    for (const [id, state] of this.status.getSnapshot()) {
      const pending = state.pendingInteraction;
      if (!pending) continue;
      const key = `${pending.kind}:${pending.key}`;
      if (!this.interactions.get(id)?.has(key)) {
        this.rememberInteraction(id, key);
        this.notify(id, "waiting");
      }
    }
    this.acknowledge();
  }

  private rememberInteraction(id: SessionId, key: string): void {
    const seen = this.interactions.get(id) ?? new Set<string>();
    seen.add(key);
    this.interactions.set(id, seen);
  }

  private needsWatch(id: SessionId, row: SessionSummary | undefined): boolean {
    return (
      !!row &&
      (row.running ||
        this.status.getSnapshot().get(id)?.running === true ||
        Object.entries(row.retainedBy).some(([source, count]) => source !== "desktopNotifications" && (count ?? 0) > 0))
    );
  }

  private reconcile(): void {
    if (!this.active || this.resetting || !this.enabled || this.generation === undefined) return;
    const list = this.sessions.list.getSnapshot();

    if (list.phase !== "ready") return;
    const members = new Set(list.ids);
    for (const id of this.interactions.keys()) if (!members.has(id)) this.interactions.delete(id);
    for (const id of this.failed) if (!this.needsWatch(id, list.byId[id]) || !members.has(id)) this.failed.delete(id);
    for (const [id, watch] of this.watches) {
      const row = list.byId[id];
      if (!members.has(id) || !row || row.parentId || row.origin === "subagent") {
        this.release(id);
        this.clear(id);
      } else if (!this.needsWatch(id, row) && !watch.inTurn && !watch.timer) {
        // Status and journal use separate transports. Allow the final journal frame to arrive.
        watch.timer = setTimeout(() => this.release(id), 5000);
      } else if ((this.needsWatch(id, row) || watch.inTurn) && watch.timer) {
        clearTimeout(watch.timer);
        watch.timer = undefined;
      }
    }
    for (const id of list.ids) {
      const row = list.byId[id];
      if (
        !row ||
        !this.needsWatch(id, row) ||
        row.parentId ||
        row.origin === "subagent" ||
        this.watches.has(id) ||
        this.acquiring.has(id) ||
        this.failed.has(id)
      )
        continue;
      this.watch(id);
    }
    for (const id of this.notices.keys()) if (!members.has(id)) this.clear(id);
    this.acknowledge();
  }

  private watch(id: SessionId): void {
    const epoch = this.epoch;
    this.acquiring.add(id);
    let acquired: SessionReference | undefined;
    try {
      const reference = this.sessions.retain(id, { source: "desktopNotifications" });
      acquired = reference;
      const source = reference.binding.eventSource;
      const watch: Watch = { reference, stop: () => {}, revision: -1, sequence: -1, inTurn: false };
      this.watches.set(id, watch);
      // Subscribe before ready: a live append may follow the baseline before ready settles.
      const observe = () => {
        if (this.epoch !== epoch || this.watches.get(id) !== watch) return;
        this.events(id, watch, source.getSnapshot());
      };
      this.baseline(watch, source.getSnapshot());
      watch.stop = source.subscribe(observe);

      void reference.ready.catch((error: unknown) => {
        if (this.epoch !== epoch || this.watches.get(id) !== watch) return;
        this.failed.add(id);
        this.env.warn(error);
        this.release(id);
      });
    } catch (error) {
      this.failed.add(id);
      if (!this.watches.has(id)) acquired?.release();
      this.release(id);
      this.env.warn(error);
    } finally {
      this.acquiring.delete(id);
    }
  }

  private baseline(watch: Watch, window: SessionEventWindow): void {
    watch.revision = window.revision;
    let lastBoundary = -1;
    for (const entry of window.entries) {
      if (entry.type !== "event") continue;
      watch.sequence = Math.max(watch.sequence, entry.event.seq);
      if ((entry.event.type === "turn/start" || entry.event.type === "turn/end") && entry.event.seq > lastBoundary) {
        lastBoundary = entry.event.seq;
        watch.inTurn = entry.event.type === "turn/start";
      }
    }
  }

  private events(id: SessionId, watch: Watch, window: SessionEventWindow): void {
    if (window.revision === watch.revision) return;
    const change = window.change;
    if (change.kind !== "append") {
      this.baseline(watch, window);
      return;
    }
    watch.revision = window.revision;
    for (const entry of change.entries) {
      if (entry.type !== "event" || entry.event.seq <= watch.sequence) continue;
      const event = entry.event;
      watch.sequence = event.seq;
      if (event.type === "turn/start") {
        watch.inTurn = true;
        clearTimeout(watch.timer);
        watch.timer = undefined;
        continue;
      }
      if (event.type !== "turn/end") continue;
      watch.inTurn = false;
      const kind = event.data.reason.kind;

      if (kind === "completed") this.notify(id, "completed");
      else if (kind === "error" || kind === "max-tokens" || kind === "blocked") this.notify(id, "failed");
      // Defer until native running state has folded this synchronous journal publication.
      queueMicrotask(() => {
        if (
          this.watches.get(id) === watch &&
          !watch.inTurn &&
          !this.needsWatch(id, this.sessions.list.getSnapshot().byId[id])
        )
          this.release(id);
      });
    }
  }

  private notify(id: SessionId, kind: NoticeKind): void {
    const row = this.sessions.list.getSnapshot().byId[id];

    if (!row || row.parentId || row.origin === "subagent" || this.env.foreground() || !this.env.allowed()) return;
    this.clear(id);
    try {
      let notice: Notice;
      notice = this.env.show(row.title?.trim().slice(0, 160) || this.env.text("fallback"), this.env.text(kind), () => {
        if (!this.active || this.notices.get(id) !== notice) return;
        this.env.open(id);
        this.acknowledge();
      });
      this.notices.set(id, notice);
    } catch (error) {
      this.env.warn(error);
    }
  }

  acknowledge = (): void => {
    if (!this.env.foreground()) return;
    const rows = this.sessions.list.getSnapshot().byId;
    for (const id of this.notices.keys()) if ((rows[id]?.retainedBy.mainView ?? 0) > 0) this.clear(id);
  };

  private clear(id: SessionId): void {
    const notice = this.notices.get(id);
    this.notices.delete(id);
    try {
      notice?.close();
    } catch (error) {
      this.env.warn(error);
    }
  }
  private release(id: SessionId): void {
    const watch = this.watches.get(id);
    if (!watch) return;
    this.watches.delete(id);
    clearTimeout(watch.timer);
    watch.stop();
    watch.reference.release();
  }
  private reset(): void {
    this.resetting = true;
    ++this.epoch;
    for (const id of this.watches.keys()) this.release(id);
    for (const id of this.notices.keys()) this.clear(id);
    this.interactions.clear();
    this.failed.clear();
    this.resetting = false;
  }
  dispose(): void {
    this.active = false;
    for (const stop of this.stops.splice(0)) stop();
    this.reset();
  }
}
