import type {
  ISessions,
  SessionEventWindow,
  SessionListState,
  SessionReference,
} from "@deepseek-ai/dsh-api-session-controller/client";
import type { SessionStatusSnapshot } from "@deepseek-ai/dsh-client-ui-session/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationController } from "../src/client/controller.ts";

function source<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (value: T) => {
      snapshot = value;
      for (const listener of [...listeners]) listener();
    },
    listeners,
  };
}
const id = "session-one" as SessionId;
const other = "session-two" as SessionId;
const controllers: NotificationController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.useRealTimers();
});

function harness(options: { running?: boolean; parent?: boolean; foreground?: boolean; allowed?: boolean } = {}) {
  let foreground = options.foreground ?? false;
  let allowed = options.allowed ?? true;
  const row = {
    id,
    displayTitle: "private fallback",
    title: "Build project",
    running: options.running ?? true,
    retainedBy: {},
    blank: false,
    updatedAt: 1,
    ...(options.parent ? { origin: "subagent" as const } : {}),
  };
  const list = source<SessionListState>({
    ids: [id, other],
    byId: { [id]: row, [other]: { ...row, id: other, running: false } },
    phase: "ready",
    projectionsBySession: {},
  });
  const events = source<SessionEventWindow>({
    entries: [],
    hasMore: false,
    revision: 0,
    change: { kind: "replace", entries: [] },
  });
  const status = source<SessionStatusSnapshot>(new Map());
  const generation = source<unknown>(1);
  const released = vi.fn();
  const reference = {
    binding: { eventSource: events },
    ready: Promise.resolve({}),
    release: released,
  } as unknown as SessionReference;
  const retain = vi.fn(() => reference);
  const show = vi.fn((_title: string, _body: string, _tag: string, click: () => void) => ({ close: vi.fn(), click }));
  const open = vi.fn();
  const warn = vi.fn();
  const controller = new NotificationController({ list, retain } as unknown as ISessions, status, generation, {
    foreground: () => foreground,
    allowed: () => allowed,
    show,
    open,
    text: (key) => key,
    warn,
  });
  controllers.push(controller);
  const append = (reason: string, seq = events.getSnapshot().revision + 1, kind = "append") => {
    const entry = {
      type: "event",
      event: { type: "turn/end", seq, time: 1, data: { turn: 1, reason: { kind: reason } } },
    };
    events.set({
      entries: [entry],
      revision: events.getSnapshot().revision + 1,
      hasMore: false,
      change: { kind, entries: [entry] },
    } as unknown as SessionEventWindow);
  };
  const pending = (key: string | undefined) =>
    status.set(
      new Map([
        [
          id,
          {
            running: true,
            completionUnread: false,
            pendingInteraction: key ? { kind: "question", key, sessionId: id } : undefined,
          },
        ],
      ]),
    );
  return {
    controller,
    row,
    list,
    events,
    status,
    generation,
    retain,
    released,
    show,
    open,
    warn,
    append,
    pending,
    foreground: (value: boolean) => {
      foreground = value;
    },
    allowed: (value: boolean) => {
      allowed = value;
    },
  };
}

describe("desktop notification policy", () => {
  it("handles synchronous native retention publication and disable without reacquiring", () => {
    const h = harness();
    const original = h.retain.getMockImplementation();
    if (!original) throw new Error("Missing retain fixture");
    h.retain.mockImplementation(() => {
      h.list.set({ ...h.list.getSnapshot() });
      return original();
    });
    h.released.mockImplementation(() => h.list.set({ ...h.list.getSnapshot() }));
    h.controller.setEnabled(true);
    expect(h.retain).toHaveBeenCalledOnce();
    h.controller.setEnabled(false);
    expect(h.retain).toHaveBeenCalledOnce();
    expect(h.released).toHaveBeenCalledOnce();
    h.controller.setEnabled(true);
    expect(h.retain).toHaveBeenCalledTimes(2);
  });
  it.each(["completed", "error", "blocked", "max-tokens"])("notifies on live %s", (reason) => {
    const h = harness();
    h.controller.setEnabled(true);
    h.append(reason);
    expect(h.show).toHaveBeenCalledWith(
      "Build project",
      reason === "completed" ? "completed" : "failed",
      `dsh-desktop-notifications:${id}`,
      expect.any(Function),
    );
  });
  it.each(["aborted", "interrupted", "forked"])("ignores %s", (reason) => {
    const h = harness();
    h.controller.setEnabled(true);
    h.append(reason);
    expect(h.show).not.toHaveBeenCalled();
  });
  it("suppresses foreground events without replay when losing focus", () => {
    const h = harness({ foreground: true });
    h.controller.setEnabled(true);
    h.append("completed");
    h.foreground(false);
    h.list.set({ ...h.list.getSnapshot() });
    expect(h.show).not.toHaveBeenCalled();
    h.append("completed");
    expect(h.show).toHaveBeenCalledTimes(1);
  });
  it("does not request permission or send when denied", () => {
    const h = harness({ allowed: false });
    h.controller.setEnabled(true);
    h.append("completed");
    h.pending("p");
    expect(h.show).not.toHaveBeenCalled();
    h.allowed(true);
    h.pending("p");
    expect(h.show).not.toHaveBeenCalled();
  });
  it("ignores child sessions and idle catalog rows", () => {
    const h = harness({ parent: true });
    h.controller.setEnabled(true);
    h.pending("p");
    expect(h.retain).not.toHaveBeenCalled();
    expect(h.show).not.toHaveBeenCalled();
  });
  it("never notifies for baseline replacement, older pages, or duplicate append", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.append("completed", 10, "replace");
    h.append("completed", 2, "prepend");
    h.append("completed", 10);
    expect(h.show).not.toHaveBeenCalled();
    h.append("completed", 11);
    expect(h.show).toHaveBeenCalledTimes(1);
  });
  it("deduplicates questions and replaces a session's earlier notification", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.pending("p");
    h.pending("p");
    expect(h.show).toHaveBeenCalledTimes(1);
    const notice = h.show.mock.results[0].value;
    h.pending("q");
    expect(notice.close).toHaveBeenCalledOnce();
    expect(h.show).toHaveBeenCalledTimes(2);
    h.append("completed");
    expect(h.show).toHaveBeenCalledTimes(3);
  });
  it("seeds existing pending questions without replay at startup", () => {
    const h = harness();
    h.pending("p");
    h.controller.setEnabled(true);
    h.pending("p");
    expect(h.show).not.toHaveBeenCalled();
    h.pending("q");
    expect(h.show).toHaveBeenCalledOnce();
  });
  it("does not repeat a question when a higher priority interaction stops hiding it", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.pending("question");
    h.pending("approval");
    h.pending("question");
    expect(h.show).toHaveBeenCalledTimes(2);
    h.pending(undefined);
    h.pending("question");
    expect(h.show).toHaveBeenCalledTimes(2);
  });
  it("clears only the viewed session while in foreground", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.append("completed");
    const notice = h.show.mock.results[0].value;
    notice.click();
    expect(h.open).toHaveBeenCalledWith(id);
    expect(notice.close).not.toHaveBeenCalled();
    h.foreground(true);
    h.controller.acknowledge();
    expect(notice.close).not.toHaveBeenCalled();
    h.row.retainedBy = { mainView: 1 } as typeof h.row.retainedBy;
    h.list.set({ ...h.list.getSnapshot() });
    expect(notice.close).toHaveBeenCalledOnce();
  });
  it("does not acknowledge a viewed session while backgrounded", () => {
    const h = harness();
    h.row.retainedBy = { mainView: 1 };
    h.controller.setEnabled(true);
    h.append("completed");
    const notice = h.show.mock.results[0].value;
    h.controller.acknowledge();
    expect(notice.close).not.toHaveBeenCalled();
    h.foreground(true);
    h.controller.acknowledge();
    expect(notice.close).toHaveBeenCalledOnce();
  });
  it("cleans generations and ignores stale journal publication", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.pending("p");
    const notice = h.show.mock.results[0].value;
    h.generation.set(undefined);
    expect(h.released).toHaveBeenCalledOnce();
    expect(notice.close).toHaveBeenCalledOnce();
    h.append("completed");
    h.pending("q");
    expect(h.show).toHaveBeenCalledOnce();
    h.generation.set(2);
    h.pending("q");
    expect(h.show).toHaveBeenCalledOnce();
    notice.click();
    expect(h.open).not.toHaveBeenCalled();
    h.append("completed");
    expect(h.show).toHaveBeenCalledTimes(2);
  });
  it("keeps the final frame after status becomes idle, then releases", async () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.row.running = false;
    h.list.set({ ...h.list.getSnapshot() });
    h.append("completed");
    await Promise.resolve();
    expect(h.show).toHaveBeenCalledOnce();
    expect(h.released).toHaveBeenCalledOnce();
    expect(h.events.listeners.size).toBe(0);
  });
  it("releases idle streams even when no final frame arrives", () => {
    vi.useFakeTimers();
    const h = harness();
    h.controller.setEnabled(true);
    h.row.running = false;
    h.list.set({ ...h.list.getSnapshot() });
    vi.advanceTimersByTime(5000);
    expect(h.released).toHaveBeenCalledOnce();
  });
  it("releases references and closes notifications on disable and dispose", () => {
    const h = harness();
    h.controller.setEnabled(true);
    h.append("completed");
    const notice = h.show.mock.results[0].value;
    h.controller.setEnabled(false);
    expect(h.released).toHaveBeenCalledOnce();
    expect(notice.close).toHaveBeenCalledOnce();
    h.pending("p");
    h.append("completed");
    expect(h.show).toHaveBeenCalledOnce();
    h.controller.dispose();
    expect(h.list.listeners.size + h.status.listeners.size + h.generation.listeners.size).toBe(0);
  });
  it("contains delivery failures and uses a generic title when absent", () => {
    const h = harness();
    h.row.title = "";
    h.show.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    h.controller.setEnabled(true);
    expect(() => h.append("completed")).not.toThrow();
    expect(h.warn).toHaveBeenCalledOnce();
    expect(h.show.mock.calls[0][0]).toBe("fallback");
  });
});
