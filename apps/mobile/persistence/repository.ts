import {
  appendSample,
  applyChange,
  applyMark,
  applyRecovered,
  applyStop,
  createLiveSession,
  currentSport,
  isLive,
  newId,
  nowMs,
  type Sample,
  type Session,
  type SessionEvent,
  type Sport,
} from "@bricklap/engine";
import { RECOVERED_HEADLESS_TYPE, replaySessions, type EventRow, type SampleRow, type StoredSession } from "./replay";
import { migrate } from "./schema";
import type { SqlDb } from "./sql";

/**
 * Same verbs as the web-lab store (`apps/web-lab/src/lib/store.ts`): hydrate,
 * start, changeSport, stop, pushSample, discardLive, live, byId. What differs
 * is underneath — SQLite instead of localStorage, and nothing is ever deleted:
 * discardLive writes a STOP with a flag.
 */
/**
 * Who restarted the process before a hydrate: the athlete opening the app
 * (`user`, the default) or Android reviving it for the background task
 * (`headless`, ADR 0010). Only the stored row differs.
 */
export type RecoveryOrigin = "user" | "headless";

export interface SessionStore {
  /**
   * Open, migrate, replay. Marks a live session as recovered and returns it.
   * Pending samples are written first: a hydrate on a store that already
   * holds a session (the app opened in a process the task revived) must not
   * replay a database that is behind its own buffer. A headless hydrate
   * right after another headless one (nothing but samples in between)
   * writes nothing: it is the same revival, seen by the next batch.
   */
  hydrate(at?: number, origin?: RecoveryOrigin): Session | null;
  start(sport: Sport, at?: number): string;
  changeSport(sport: Sport, at?: number): void;
  /** "Marca": close the open block and start the next, same sport (Fase 4). */
  mark(at?: number): void;
  stop(at?: number): string | null;
  pushSample(sample: Sample): void;
  discardLive(at?: number): void;
  live(): Session | null;
  byId(id: string): Session | undefined;
  summaries(): SessionSummary[];
  /** Write buffered samples now. Returns how many rows went to disk. */
  flush(): number;
  /**
   * Erase one session for good: its events and its samples, by id. The one
   * DELETE in the adapter (ADR 0006, decided in session 03 for Fase 4) —
   * the athlete's right to erasure is an explicit operation, not a flag, and
   * it has nothing to preserve. Returns the rows removed, or null when no
   * session has that id. Deleting the live session also ends it in memory.
   */
  deleteSession(id: string): { events: number; samples: number } | null;
  /** A stored preference, or null. Preferences are metadata, not session data. */
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
}

export type SessionSummary = {
  /** Events only; `samples` is always empty here. Enough for duration and segments. */
  session: Session;
  discarded: boolean;
  sampleCount: number;
};

export type WriteTiming = {
  kind: "event" | "batch";
  ms: number;
  /** Rows written in this transaction (an event write also flushes pending samples). */
  rows: number;
};

export type RepositoryOptions = {
  /**
   * How long a sample may wait in memory before the batch hits disk.
   * 0 writes each sample at once. Bounds the loss on a hard kill: at most
   * one interval of samples (plus the sample in flight) is lost, never an event.
   */
  flushIntervalMs?: number;
  now?: () => number;
  /** High-resolution clock for timings; defaults to performance.now(). */
  clock?: () => number;
  onTiming?: (timing: WriteTiming) => void;
};

export const DEFAULT_FLUSH_INTERVAL_MS = 2000;

const SELECT_EVENTS = "SELECT seq, session_id, type, at, sport, discarded FROM events";
const SELECT_SAMPLES = "SELECT session_id, t, lat, lng, speed_mps, source, accuracy FROM samples";

function defaultClock(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return p?.now ? p.now() : Date.now();
}

export class SqliteSessionStore implements SessionStore {
  private readonly db: SqlDb;
  private readonly flushIntervalMs: number;
  private readonly now: () => number;
  private readonly clock: () => number;
  private readonly onTiming: ((t: WriteTiming) => void) | undefined;

  private liveSession: Session | null = null;
  private migrated = false;
  private pending: { sessionId: string; sample: Sample }[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(db: SqlDb, options: RepositoryOptions = {}) {
    this.db = db;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.now = options.now ?? nowMs;
    this.clock = options.clock ?? defaultClock;
    this.onTiming = options.onTiming;
  }

  hydrate(at = this.now(), origin: RecoveryOrigin = "user"): Session | null {
    migrate(this.db);
    this.migrated = true;
    this.flush();
    const live = this.loadLive();
    if (!live) {
      this.liveSession = null;
      return null;
    }
    if (origin === "headless" && this.lastEventType(live.id) === RECOVERED_HEADLESS_TYPE) {
      // Still the same revival: in a process Android brought back, the task
      // manager builds a fresh JS context for each batch of fixes and drops
      // it after, so every batch hydrates. One row per revival, not per batch.
      this.liveSession = live;
      return live;
    }
    const recovered = applyRecovered(live, at);
    const added = recovered.events.length > live.events.length;
    if (added) {
      this.writeEvent(recovered.id, recovered.events[recovered.events.length - 1]!, false, origin);
    }
    this.liveSession = recovered;
    return recovered;
  }

  live(): Session | null {
    return this.liveSession;
  }

  start(sport: Sport, at = this.now()): string {
    if (this.liveSession) return this.liveSession.id;
    const session = createLiveSession(sport, at, newId());
    this.writeEvent(session.id, session.events[0]!, false);
    this.liveSession = session;
    return session.id;
  }

  changeSport(sport: Sport, at = this.now()): void {
    const live = this.liveSession;
    if (!live) return;
    if (currentSport(live.events) === sport) return;
    const next = applyChange(live, sport, at);
    if (next === live) return;
    this.writeEvent(next.id, next.events[next.events.length - 1]!, false);
    this.liveSession = next;
  }

  /**
   * "Marca". Same write path as a CHANGE — pending samples first, then the
   * event, one transaction, on disk before the screen reacts — because it is
   * the same kind of boundary: what changes is the block, not the sport.
   * A mark the engine refuses (nothing open, or no time since the last one)
   * writes nothing.
   */
  mark(at = this.now()): void {
    const live = this.liveSession;
    if (!live) return;
    const next = applyMark(live, at);
    if (next === live) return;
    this.writeEvent(next.id, next.events[next.events.length - 1]!, false);
    this.liveSession = next;
  }

  stop(at = this.now()): string | null {
    return this.closeLive(at, false);
  }

  discardLive(at = this.now()): void {
    this.closeLive(at, true);
  }

  pushSample(sample: Sample): void {
    const live = this.liveSession;
    if (!live || !isLive(live)) return;
    this.liveSession = appendSample(live, sample);
    this.pending.push({ sessionId: live.id, sample });
    if (this.flushIntervalMs <= 0) {
      this.flush();
      return;
    }
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, this.flushIntervalMs);
    }
  }

  flush(): number {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pending.length === 0) return 0;
    const batch = this.pending;
    this.pending = [];
    const t0 = this.clock();
    this.db.withTransactionSync(() => {
      for (const p of batch) this.insertSample(p.sessionId, p.sample);
    });
    this.onTiming?.({ kind: "batch", ms: this.clock() - t0, rows: batch.length });
    return batch.length;
  }

  byId(id: string): Session | undefined {
    const events = this.db.getAllSync<EventRow>(`${SELECT_EVENTS} WHERE session_id = ? ORDER BY seq`, [id]);
    if (events.length === 0) return undefined;
    const samples = this.db.getAllSync<SampleRow>(`${SELECT_SAMPLES} WHERE session_id = ? ORDER BY seq`, [id]);
    return replaySessions(events, samples)[0]?.session;
  }

  summaries(): SessionSummary[] {
    const events = this.db.getAllSync<EventRow>(`${SELECT_EVENTS} ORDER BY seq`, []);
    const counts = this.db.getAllSync<{ session_id: string; n: number }>(
      "SELECT session_id, COUNT(*) AS n FROM samples GROUP BY session_id",
      [],
    );
    const countById = new Map(counts.map((c) => [c.session_id, c.n]));
    return replaySessions(events, []).map((s) => ({
      session: s.session,
      discarded: s.discarded,
      sampleCount: countById.get(s.session.id) ?? 0,
    }));
  }

  deleteSession(id: string): { events: number; samples: number } | null {
    migrate(this.db);
    const counted = this.db.getAllSync<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE session_id = ?", [id]);
    if ((counted[0]?.n ?? 0) === 0) return null;
    const samples = this.db.getAllSync<{ n: number }>("SELECT COUNT(*) AS n FROM samples WHERE session_id = ?", [id])[0]?.n ?? 0;
    // Samples still in memory for this session would be written back by the
    // next flush and resurrect it as an orphan, so they go first.
    this.pending = this.pending.filter((p) => p.sessionId !== id);
    this.db.withTransactionSync(() => {
      this.db.runSync("DELETE FROM samples WHERE session_id = ?", [id]);
      this.db.runSync("DELETE FROM events WHERE session_id = ?", [id]);
    });
    if (this.liveSession?.id === id) this.liveSession = null;
    return { events: counted[0]!.n, samples };
  }

  getSetting(key: string): string | null {
    this.ensureMigrated();
    return this.db.getAllSync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])[0]?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.ensureMigrated();
    this.db.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }

  /** Full replay of everything on disk. The recovery test compares against this. */
  loadAll(): StoredSession[] {
    const events = this.db.getAllSync<EventRow>(`${SELECT_EVENTS} ORDER BY seq`, []);
    const samples = this.db.getAllSync<SampleRow>(`${SELECT_SAMPLES} ORDER BY seq`, []);
    return replaySessions(events, samples);
  }

  // -- internals -----------------------------------------------------------

  /**
   * The theme is read before the first frame, which may be before `hydrate`
   * has run on a fresh install. Migrating is idempotent and cheap, but not
   * free, so it happens once per store.
   */
  private ensureMigrated(): void {
    if (this.migrated) return;
    migrate(this.db);
    this.migrated = true;
  }

  private loadLive(): Session | null {
    // Events are few; replay them all, then fetch samples for the live one only.
    const events = this.db.getAllSync<EventRow>(`${SELECT_EVENTS} ORDER BY seq`, []);
    const live = replaySessions(events, []).filter((s) => isLive(s.session));
    // More than one live session cannot be written by this adapter; if it ever
    // shows up on disk, the newest is the one the athlete was recording.
    const chosen = live[live.length - 1];
    if (!chosen) return null;
    const samples = this.db.getAllSync<SampleRow>(`${SELECT_SAMPLES} WHERE session_id = ? ORDER BY seq`, [
      chosen.session.id,
    ]);
    return replaySessions(events.filter((e) => e.session_id === chosen.session.id), samples)[0]!.session;
  }

  /** The stored type of a session's newest event row, before replay folds it. */
  private lastEventType(sessionId: string): string | undefined {
    return this.db.getAllSync<{ type: string }>(
      "SELECT type FROM events WHERE session_id = ? ORDER BY seq DESC LIMIT 1",
      [sessionId],
    )[0]?.type;
  }

  private closeLive(at: number, discarded: boolean): string | null {
    const live = this.liveSession;
    if (!live) return null;
    const next = applyStop(live, at);
    if (next.events.length > live.events.length) {
      this.writeEvent(next.id, next.events[next.events.length - 1]!, discarded);
    }
    this.liveSession = null;
    return next.id;
  }

  /**
   * Synchronous, one transaction: pending samples first (so a boundary sample
   * lands before the CHANGE/STOP that follows it), then the event. When this
   * returns, the event is on disk. A headless recovery is the one event
   * whose row type differs from the engine's (`recovered_headless`).
   */
  private writeEvent(sessionId: string, event: SessionEvent, discarded: boolean, origin: RecoveryOrigin = "user"): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const batch = this.pending;
    this.pending = [];
    const t0 = this.clock();
    this.db.withTransactionSync(() => {
      for (const p of batch) this.insertSample(p.sessionId, p.sample);
      const sport = event.type === "started" || event.type === "sport_changed" ? event.sport : null;
      const type = event.type === "recovered" && origin === "headless" ? RECOVERED_HEADLESS_TYPE : event.type;
      this.db.runSync("INSERT INTO events (session_id, type, at, sport, discarded) VALUES (?, ?, ?, ?, ?)", [
        sessionId,
        type,
        event.at,
        sport,
        discarded ? 1 : 0,
      ]);
    });
    this.onTiming?.({ kind: "event", ms: this.clock() - t0, rows: batch.length + 1 });
  }

  private insertSample(sessionId: string, s: Sample): void {
    this.db.runSync(
      "INSERT INTO samples (session_id, t, lat, lng, speed_mps, source, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [sessionId, s.t, s.lat, s.lng, s.speedMps, s.source, s.accuracyM ?? null],
    );
  }
}
