import { describe, expect, it, vi } from "vitest";
import {
  applyChange,
  applyRecovered,
  applyStop,
  blocksFromEvents,
  createLiveSession,
  isLive,
  segmentMetrics,
  segmentsFromEvents,
  sessionMetrics,
  type Sample,
} from "@bricklap/engine";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  SqliteSessionStore,
  migrate,
  readSchemaVersion,
  replaySessions,
  type Migration,
  type WriteTiming,
} from "../persistence";
import { openNodeDb } from "./helpers/node-db";

const T0 = 1_760_000_000_000;

function sample(t: number, i: number): Sample {
  return { t, lat: 38.7223 + i * 1e-5, lng: -9.1393 + i * 1e-5, speedMps: 3, source: "sim" };
}

function countRows(db: ReturnType<typeof openNodeDb>, table: string): number {
  return (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("schema", () => {
  it("starts at 0 and migrates to the current version inside the version table", () => {
    const db = openNodeDb();
    expect(readSchemaVersion(db)).toBe(0);
    expect(migrate(db)).toEqual({ from: 0, to: SCHEMA_VERSION });
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    // Idempotent: a second boot crosses nothing.
    expect(migrate(db)).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION });
  });

  it("applies only the migrations above the stored version, in order, preserving rows", () => {
    const db = openNodeDb();
    migrate(db);
    db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", ["s1", "started", T0, "run"]);
    const future: Migration = {
      version: SCHEMA_VERSION + 1,
      up: (d) => d.execSync("ALTER TABLE events ADD COLUMN note TEXT"),
    };
    expect(migrate(db, [...MIGRATIONS, future])).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION + 1 });
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION + 1);
    expect(countRows(db, "events")).toBe(1);
  });

  it("refuses a gap in the migration sequence and leaves the version untouched", () => {
    const db = openNodeDb();
    migrate(db);
    const skipping: Migration = { version: SCHEMA_VERSION + 2, up: () => {} };
    expect(() => migrate(db, [...MIGRATIONS, skipping])).toThrow(/does not follow/);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
  });

  it("rolls the version back when a migration throws", () => {
    const db = openNodeDb();
    migrate(db);
    const broken: Migration = {
      version: SCHEMA_VERSION + 1,
      up: (d) => d.execSync("CREATE TABLE nope (x INTEGER); INSERT INTO nope VALUES ('not', 'ok')"),
    };
    expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow();
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(() => db.getAllSync("SELECT * FROM nope", [])).toThrow();
  });
});

describe("replaySessions", () => {
  it("derives status and createdAt from events and attaches samples", () => {
    const stored = replaySessions(
      [
        { seq: 1, session_id: "a", type: "started", at: T0, sport: "run", discarded: 0, payload: null },
        { seq: 2, session_id: "a", type: "sport_changed", at: T0 + 10_000, sport: "bike", discarded: 0, payload: null },
        { seq: 3, session_id: "b", type: "started", at: T0 + 20_000, sport: "walk", discarded: 0, payload: null },
        { seq: 4, session_id: "a", type: "stopped", at: T0 + 30_000, sport: null, discarded: 1, payload: null },
      ],
      [
        { session_id: "a", t: T0, lat: 1, lng: 2, speed_mps: 3, source: "sim", accuracy: null },
        { session_id: "b", t: T0 + 20_000, lat: 4, lng: 5, speed_mps: 1, source: "gps", accuracy: 4.25 },
        { session_id: "ghost", t: T0, lat: 0, lng: 0, speed_mps: 0, source: "sim", accuracy: null },
      ],
    );
    expect(stored.map((s) => s.session.id)).toEqual(["a", "b"]);
    const [a, b] = stored;
    expect(a!.session.status).toBe("stopped");
    expect(a!.discarded).toBe(true);
    expect(a!.session.createdAt).toBe(T0);
    expect(a!.session.events).toEqual([
      { type: "started", at: T0, sport: "run" },
      { type: "sport_changed", at: T0 + 10_000, sport: "bike" },
      { type: "stopped", at: T0 + 30_000 },
    ]);
    expect(a!.session.samples).toEqual([{ t: T0, lat: 1, lng: 2, speedMps: 3, source: "sim" }]);
    // No accuracy on disk → no key at all on the sample (not null), so a
    // replayed session equals the one the engine built in memory.
    expect("accuracyM" in a!.session.samples[0]!).toBe(false);
    expect(b!.session.status).toBe("live");
    expect(b!.discarded).toBe(false);
    expect(b!.session.samples[0]).toEqual({ t: T0 + 20_000, lat: 4, lng: 5, speedMps: 1, source: "gps", accuracyM: 4.25 });
  });

  it("is loud about rows it does not understand", () => {
    expect(() =>
      replaySessions([{ seq: 7, session_id: "a", type: "paused", at: T0, sport: null, discarded: 0, payload: null }], []),
    ).toThrow(/seq=7: unknown type "paused"/);
    expect(() =>
      replaySessions([{ seq: 8, session_id: "a", type: "started", at: T0, sport: "swim", discarded: 0, payload: null }], []),
    ).toThrow(/seq=8: sport "swim"/);
    expect(() =>
      replaySessions([{ seq: 9, session_id: "a", type: "stopped", at: T0, sport: null, discarded: 0, payload: null }], []),
    ).toThrow(/begins with stopped/);
    expect(() =>
      replaySessions(
        [{ seq: 1, session_id: "a", type: "started", at: T0, sport: "run", discarded: 0, payload: null }],
        [{ session_id: "a", t: T0, lat: 0, lng: 0, speed_mps: 0, source: "guess", accuracy: null }],
      ),
    ).toThrow(/unknown source "guess"/);
  });
});

describe("migration v2 — accuracy next to the sample (ADR 0009)", () => {
  it("adds a nullable accuracy column to samples", () => {
    expect(MIGRATIONS.map((m) => m.version)).toContain(2);
    const db = openNodeDb();
    migrate(db);
    const cols = db.raw.prepare("PRAGMA table_info(samples)").all() as { name: string; type: string; notnull: number }[];
    expect(cols.find((c) => c.name === "accuracy")).toMatchObject({ type: "REAL", notnull: 0 });
  });

  it("upgrades a v1 database in place: rows, seqs and columns untouched, accuracy NULL for old fixes", () => {
    const db = openNodeDb();
    // A phone that recorded the session 04 walk on schema v1.
    expect(migrate(db, MIGRATIONS.slice(0, 1))).toEqual({ from: 0, to: 1 });
    db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", ["walk", "started", T0, "walk"]);
    db.runSync("INSERT INTO samples (session_id, t, lat, lng, speed_mps, source) VALUES (?, ?, ?, ?, ?, ?)", [
      "walk",
      T0,
      38.7,
      -9.1,
      1.4,
      "gps",
    ]);
    db.runSync("INSERT INTO samples (session_id, t, lat, lng, speed_mps, source) VALUES (?, ?, ?, ?, ?, ?)", [
      "walk",
      T0 + 1_000,
      38.70001,
      -9.10001,
      1.4,
      "gps",
    ]);

    expect(migrate(db)).toEqual({ from: 1, to: SCHEMA_VERSION });
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const rows = db.raw.prepare("SELECT seq, t, speed_mps, source, accuracy FROM samples ORDER BY seq").all();
    expect(rows).toEqual([
      { seq: 1, t: T0, speed_mps: 1.4, source: "gps", accuracy: null },
      { seq: 2, t: T0 + 1_000, speed_mps: 1.4, source: "gps", accuracy: null },
    ]);
    // The store opens the upgraded database and replays the old fixes without an accuracy.
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 + 5_000 });
    const live = store.hydrate();
    expect(live?.samples).toHaveLength(2);
    expect(live!.samples.every((s) => !("accuracyM" in s))).toBe(true);
  });

  it("round-trips the accuracy of a real fix and stores NULL for a sample without one", () => {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 });
    store.hydrate(T0);
    const id = store.start("run", T0);
    const real: Sample = { ...sample(T0, 0), source: "gps", accuracyM: 3.09 };
    const sim = sample(T0 + 1_000, 1);
    store.pushSample(real);
    store.pushSample(sim);
    store.stop(T0 + 2_000);
    const rows = db.raw.prepare("SELECT accuracy FROM samples ORDER BY seq").all();
    expect(rows).toEqual([{ accuracy: 3.09 }, { accuracy: null }]);
    expect(store.byId(id)!.samples).toEqual([real, sim]);
  });
});

describe("SqliteSessionStore", () => {
  function fresh(opts: { flushIntervalMs?: number; onTiming?: (t: WriteTiming) => void } = {}) {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0, ...opts });
    return { db, store };
  }

  it("hydrates an empty database to no live session", () => {
    const { db, store } = fresh();
    expect(store.hydrate(T0)).toBeNull();
    expect(store.live()).toBeNull();
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(store.summaries()).toEqual([]);
  });

  it("writes every event synchronously and never updates or deletes", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    const id = store.start("run", T0);
    expect(countRows(db, "events")).toBe(1);
    store.changeSport("bike", T0 + 5_000);
    expect(countRows(db, "events")).toBe(2);
    // Same sport again: nothing to record, nothing written.
    store.changeSport("bike", T0 + 6_000);
    expect(countRows(db, "events")).toBe(2);
    expect(store.stop(T0 + 9_000)).toBe(id);
    expect(countRows(db, "events")).toBe(3);
    expect(store.live()).toBeNull();
    // Stopping again is a no-op: there is no live session.
    expect(store.stop(T0 + 10_000)).toBeNull();
    expect(countRows(db, "events")).toBe(3);
    const rows = db.raw.prepare("SELECT type, at, sport, discarded FROM events ORDER BY seq").all();
    expect(rows).toEqual([
      { type: "started", at: T0, sport: "run", discarded: 0 },
      { type: "sport_changed", at: T0 + 5_000, sport: "bike", discarded: 0 },
      { type: "stopped", at: T0 + 9_000, sport: null, discarded: 0 },
    ]);
  });

  it("start while live returns the live id, like the web-lab store", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    const id = store.start("run", T0);
    expect(store.start("walk", T0 + 1_000)).toBe(id);
    expect(countRows(db, "events")).toBe(1);
  });

  it("discardLive is a STOP with the flag set, not a DELETE", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    const id = store.start("run", T0);
    store.pushSample(sample(T0, 0));
    store.discardLive(T0 + 3_000);
    expect(store.live()).toBeNull();
    expect(countRows(db, "events")).toBe(2);
    expect(countRows(db, "samples")).toBe(1);
    const [summary] = store.summaries();
    expect(summary).toMatchObject({ discarded: true, sampleCount: 1 });
    expect(summary!.session.id).toBe(id);
    expect(summary!.session.status).toBe("stopped");
  });

  it("replays the exact session the engine built in memory", () => {
    const { store } = fresh();
    store.hydrate(T0);
    const id = store.start("run", T0);
    let expected = createLiveSession("run", T0, id);
    for (let i = 0; i < 12; i++) {
      const s = sample(T0 + i * 1_000, i);
      store.pushSample(s);
      expected = { ...expected, samples: [...expected.samples, s] };
      if (i === 5) {
        store.changeSport("bike", s.t);
        expected = applyChange(expected, "bike", s.t);
      }
    }
    store.stop(T0 + 11_000);
    expected = applyStop(expected, T0 + 11_000);

    const replayed = store.byId(id)!;
    expect(replayed).toEqual(expected);
    // Derived numbers agree too, since the inputs are identical.
    expect(sessionMetrics(replayed)).toEqual(sessionMetrics(expected));
    const segs = segmentsFromEvents(replayed.events);
    expect(segs).toHaveLength(2);
    expect(segmentMetrics(replayed, segs[1]!)).toEqual(segmentMetrics(expected, segs[1]!));
  });

  it("hydrate on a live session appends one recovered event and returns it live", () => {
    const db = openNodeDb();
    const first = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    first.hydrate(T0);
    const id = first.start("walk", T0);
    first.pushSample(sample(T0, 0));
    first.pushSample(sample(T0 + 1_000, 1));
    // Process dies here: no stop, samples already on disk because interval is 0.

    const second = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    const live = second.hydrate(T0 + 60_000);
    expect(live).not.toBeNull();
    expect(live!.id).toBe(id);
    expect(isLive(live!)).toBe(true);
    expect(live!.events).toEqual([
      { type: "started", at: T0, sport: "walk" },
      { type: "recovered", at: T0 + 60_000 },
    ]);
    expect(live!.samples).toHaveLength(2);
    expect(countRows(db, "events")).toBe(2);
    // The recovered event is what the engine itself would append.
    const expected = applyRecovered(
      { ...createLiveSession("walk", T0, id), samples: live!.samples },
      T0 + 60_000,
    );
    expect(live).toEqual(expected);
  });

  it("a headless hydrate (ADR 0010) writes recovered_headless, which replays as a plain recovered", () => {
    const db = openNodeDb();
    const first = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    first.hydrate(T0);
    const id = first.start("walk", T0);
    first.pushSample(sample(T0, 0));
    // The process dies; Android revives it for the next batch of fixes and
    // the background task hydrates the store itself.
    const task = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    const live = task.hydrate(T0 + 30_000, "headless");
    expect(live!.events).toEqual([
      { type: "started", at: T0, sport: "walk" },
      { type: "recovered", at: T0 + 30_000 },
    ]);
    task.pushSample(sample(T0 + 31_000, 1));
    // Then the athlete opens the app: a plain recovered, as always.
    const app = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    app.hydrate(T0 + 90_000);
    const rows = db.raw.prepare("SELECT type, at, sport FROM events WHERE session_id = ? ORDER BY seq").all(id);
    expect(rows).toEqual([
      { type: "started", at: T0, sport: "walk" },
      { type: "recovered_headless", at: T0 + 30_000, sport: null },
      { type: "recovered", at: T0 + 90_000, sport: null },
    ]);
    // The engine never sees the difference; the summary counts the samples of both contexts.
    expect(app.byId(id)!.events.map((e) => e.type)).toEqual(["started", "recovered", "recovered"]);
    expect(app.summaries()[0]!.sampleCount).toBe(2);
    expect(() => replaySessions([{ seq: 1, session_id: id, type: "recovered_headless", at: T0, sport: null, discarded: 0, payload: null }], [])).toThrow(
      /begins with recovered/,
    );
  });

  it("collapses consecutive headless hydrates into one row per revival (a fresh JS context per batch)", () => {
    const db = openNodeDb();
    const first = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    first.hydrate(T0);
    const id = first.start("walk", T0);
    first.pushSample(sample(T0, 0));
    // The process dies. Android revives it; each batch of fixes runs in a new
    // JS context that hydrates, pushes, and is torn down.
    for (let i = 1; i <= 3; i++) {
      const batch = new SqliteSessionStore(db, { flushIntervalMs: 0 });
      const live = batch.hydrate(T0 + i * 9_000, "headless");
      expect(live!.id).toBe(id);
      batch.pushSample(sample(T0 + i * 9_000 + 500, i));
    }
    // The athlete opens the app, continues; later the process dies again.
    new SqliteSessionStore(db, { flushIntervalMs: 0 }).hydrate(T0 + 60_000);
    new SqliteSessionStore(db, { flushIntervalMs: 0 }).hydrate(T0 + 120_000, "headless");
    new SqliteSessionStore(db, { flushIntervalMs: 0 }).hydrate(T0 + 129_000, "headless");
    const rows = db.raw.prepare("SELECT type, at FROM events WHERE session_id = ? ORDER BY seq").all(id);
    expect(rows).toEqual([
      { type: "started", at: T0 },
      { type: "recovered_headless", at: T0 + 9_000 },
      { type: "recovered", at: T0 + 60_000 },
      { type: "recovered_headless", at: T0 + 120_000 },
    ]);
    expect(countRows(db, "samples")).toBe(4);
  });

  it("hydrate writes the samples still in the buffer before replaying (a revived process reopened by the athlete)", () => {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 60_000, now: () => T0 });
    store.hydrate(T0);
    const id = store.start("run", T0);
    store.pushSample(sample(T0 + 1_000, 0));
    expect(countRows(db, "samples")).toBe(0);
    const live = store.hydrate(T0 + 5_000);
    expect(countRows(db, "samples")).toBe(1);
    expect(live!.id).toBe(id);
    expect(live!.samples).toHaveLength(1);
    expect(live!.events.map((e) => e.type)).toEqual(["started", "recovered"]);
  });

  it("hydrate on a stopped session returns null and writes nothing", () => {
    const db = openNodeDb();
    const first = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    first.hydrate(T0);
    first.start("run", T0);
    first.stop(T0 + 1_000);
    const second = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    expect(second.hydrate(T0 + 5_000)).toBeNull();
    expect(countRows(db, "events")).toBe(2);
  });

  it("with two live sessions on disk, recovers the newest one", () => {
    const db = openNodeDb();
    migrate(db);
    for (const [id, at] of [["old", T0], ["new", T0 + 1_000]] as const) {
      db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", [id, "started", at, "run"]);
    }
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    expect(store.hydrate(T0 + 2_000)?.id).toBe("new");
  });

  it("buffers samples for at most the flush interval, and an event flushes them first", () => {
    vi.useFakeTimers();
    try {
      const timings: WriteTiming[] = [];
      const { db, store } = fresh({ flushIntervalMs: 2_000, onTiming: (t) => timings.push(t) });
      store.hydrate(T0);
      store.start("run", T0);
      store.pushSample(sample(T0, 0));
      store.pushSample(sample(T0 + 1_000, 1));
      expect(countRows(db, "samples")).toBe(0);
      expect(store.live()!.samples).toHaveLength(2);

      vi.advanceTimersByTime(1_999);
      expect(countRows(db, "samples")).toBe(0);
      vi.advanceTimersByTime(1);
      expect(countRows(db, "samples")).toBe(2);

      store.pushSample(sample(T0 + 2_000, 2));
      store.changeSport("bike", T0 + 2_000);
      // The boundary sample is on disk with the CHANGE, in one transaction.
      expect(countRows(db, "samples")).toBe(3);
      const seqs = db.raw
        .prepare("SELECT (SELECT MAX(seq) FROM samples) AS s, (SELECT MAX(seq) FROM events) AS e")
        .get() as { s: number; e: number };
      expect(seqs.s).toBe(3);
      expect(seqs.e).toBe(2);
      // No timer left behind once the event has drained the buffer.
      vi.advanceTimersByTime(10_000);
      expect(countRows(db, "samples")).toBe(3);

      expect(timings.map((t) => [t.kind, t.rows])).toEqual([
        ["event", 1],
        ["batch", 2],
        ["event", 2],
      ]);
      expect(timings.every((t) => t.ms >= 0)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flush() writes the buffer on demand and reports the count", () => {
    vi.useFakeTimers();
    try {
      const { db, store } = fresh({ flushIntervalMs: 2_000 });
      store.hydrate(T0);
      store.start("run", T0);
      store.pushSample(sample(T0, 0));
      expect(store.flush()).toBe(1);
      expect(store.flush()).toBe(0);
      expect(countRows(db, "samples")).toBe(1);
      vi.advanceTimersByTime(5_000);
      expect(countRows(db, "samples")).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores samples when nothing is live", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    store.pushSample(sample(T0, 0));
    expect(countRows(db, "samples")).toBe(0);
    store.start("run", T0);
    store.stop(T0 + 1_000);
    store.pushSample(sample(T0 + 2_000, 1));
    expect(countRows(db, "samples")).toBe(0);
  });

  it("byId of an unknown session is undefined; summaries list every session in write order", () => {
    const { store } = fresh();
    store.hydrate(T0);
    expect(store.byId("nope")).toBeUndefined();
    const a = store.start("run", T0);
    store.stop(T0 + 1_000);
    const b = store.start("bike", T0 + 2_000);
    store.pushSample(sample(T0 + 2_000, 0));
    const list = store.summaries();
    expect(list.map((s) => s.session.id)).toEqual([a, b]);
    expect(list.map((s) => s.session.status)).toEqual(["stopped", "live"]);
    expect(list.map((s) => s.sampleCount)).toEqual([0, 1]);
    expect(list.every((s) => s.session.samples.length === 0)).toBe(true);
  });
});

describe("migration v3 — as preferências do atleta (Fase 4)", () => {
  it("is a version on the way (v4 followed it in session 26) and adds a settings table that is not session data", () => {
    expect(MIGRATIONS.map((m) => m.version)).toContain(3);
    const db = openNodeDb();
    migrate(db);
    const cols = db.raw.prepare("PRAGMA table_info(settings)").all() as { name: string; pk: number; notnull: number }[];
    expect(cols.map((c) => c.name)).toEqual(["key", "value"]);
    expect(cols.find((c) => c.name === "key")).toMatchObject({ pk: 1 });
    expect(cols.find((c) => c.name === "value")).toMatchObject({ notnull: 1 });
  });

  it("upgrades a v2 database without touching a single row of events or samples", () => {
    const db = openNodeDb();
    expect(migrate(db, MIGRATIONS.slice(0, 2))).toEqual({ from: 0, to: 2 });
    // Rows written by hand: opening the store would migrate the database to
    // the current version before this test got to do it itself.
    const id = "gym-1";
    db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", [id, "started", T0, "strength"]);
    db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", [id, "marked", T0 + 30_000, null]);
    db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", [id, "stopped", T0 + 60_000, null]);
    db.runSync("INSERT INTO samples (session_id, t, lat, lng, speed_mps, source, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id,
      T0,
      38.7,
      -9.1,
      0,
      "gps",
      4,
    ]);
    const antes = db.raw.prepare("SELECT * FROM events ORDER BY seq").all();
    const antesS = db.raw.prepare("SELECT * FROM samples ORDER BY seq").all();

    expect(migrate(db)).toEqual({ from: 2, to: SCHEMA_VERSION });
    // v4 adds a column to events (NULL on every old row); the rows themselves are the same.
    expect(
      (db.raw.prepare("SELECT * FROM events ORDER BY seq").all() as Record<string, unknown>[]).map(({ payload, ...r }) => r),
    ).toEqual(antes);
    expect(db.raw.prepare("SELECT * FROM samples ORDER BY seq").all()).toEqual(antesS);
    expect(new SqliteSessionStore(db).byId(id)!.events).toHaveLength(3);
  });

  it("stores a preference, reads it back, and overwrites it in place", () => {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db);
    // Read before any hydrate: the theme is needed before the first frame.
    expect(store.getSetting("tema")).toBeNull();
    store.setSetting("tema", "hibrido");
    expect(store.getSetting("tema")).toBe("hibrido");
    store.setSetting("tema", "escuro");
    expect(store.getSetting("tema")).toBe("escuro");
    expect(countRows(db, "settings")).toBe(1);
  });
});

describe("Marca — o evento que fecha um bloco (Fase 4)", () => {
  function fresh() {
    const db = openNodeDb();
    return { db, store: new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 }) };
  }

  it("writes one 'marked' row, with no sport, and replays as a block boundary", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    const id = store.start("strength", T0);
    store.mark(T0 + 60_000);
    store.mark(T0 + 150_000);
    store.stop(T0 + 200_000);

    const rows = db.raw.prepare("SELECT type, at, sport FROM events ORDER BY seq").all();
    expect(rows).toEqual([
      { type: "started", at: T0, sport: "strength" },
      { type: "marked", at: T0 + 60_000, sport: null },
      { type: "marked", at: T0 + 150_000, sport: null },
      { type: "stopped", at: T0 + 200_000, sport: null },
    ]);

    const stored = store.byId(id)!;
    expect(blocksFromEvents(stored.events)).toHaveLength(3);
    // The segment list is what it was before this event existed.
    expect(segmentsFromEvents(stored.events)).toHaveLength(1);
  });

  it("a mark flushes the pending samples first, so the boundary sample lands before it", () => {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 60_000, now: () => T0 });
    store.hydrate(T0);
    store.start("run", T0);
    store.pushSample(sample(T0 + 1_000, 1));
    expect(countRows(db, "samples")).toBe(0);
    store.mark(T0 + 2_000);
    expect(countRows(db, "samples")).toBe(1);
  });

  it("writes nothing when there is nothing to close", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    store.mark(T0);
    expect(countRows(db, "events")).toBe(0);
    store.start("strength", T0);
    // Same instant as the block's start, and then earlier: a zero-length block.
    store.mark(T0);
    store.mark(T0 - 1);
    expect(countRows(db, "events")).toBe(1);
    store.stop(T0 + 1_000);
    store.mark(T0 + 2_000);
    expect(countRows(db, "events")).toBe(2);
  });

  it("a marked session survives a hydrate exactly as it was written", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    store.start("rowing_indoor", T0);
    store.mark(T0 + 30_000);
    const live = store.live()!;
    const outro = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 + 40_000 });
    const recuperada = outro.hydrate(T0 + 40_000)!;
    expect(recuperada.events.slice(0, 2)).toEqual(live.events);
    expect(recuperada.events.at(-1)).toEqual({ type: "recovered", at: T0 + 40_000 });
  });
});

describe("deleteSession — o apagar a pedido do atleta (RGPD, ADR 0006)", () => {
  function fresh() {
    const db = openNodeDb();
    return { db, store: new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 }) };
  }

  it("removes the events and the samples of that session, and only those", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    const a = store.start("run", T0);
    store.pushSample(sample(T0, 0));
    store.pushSample(sample(T0 + 1_000, 1));
    store.stop(T0 + 2_000);
    const b = store.start("strength", T0 + 3_000);
    store.stop(T0 + 4_000);

    expect(store.deleteSession(a)).toEqual({ events: 2, samples: 2 });
    expect(countRows(db, "events")).toBe(2);
    expect(countRows(db, "samples")).toBe(0);
    expect(store.byId(a)).toBeUndefined();
    expect(store.byId(b)).toBeDefined();
    expect(store.summaries().map((s) => s.session.id)).toEqual([b]);
  });

  it("an unknown id deletes nothing and says so", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    store.start("run", T0);
    store.stop(T0 + 1_000);
    expect(store.deleteSession("nope")).toBeNull();
    expect(countRows(db, "events")).toBe(2);
  });

  it("deleting the live session ends it in memory and drops its buffered samples", () => {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 60_000, now: () => T0 });
    store.hydrate(T0);
    const id = store.start("run", T0);
    store.pushSample(sample(T0 + 1_000, 1));
    expect(store.deleteSession(id)).toEqual({ events: 1, samples: 0 });
    expect(store.live()).toBeNull();
    // The buffered sample must not come back and recreate an orphan session.
    expect(store.flush()).toBe(0);
    expect(countRows(db, "samples")).toBe(0);
    expect(store.hydrate(T0 + 2_000)).toBeNull();
  });

  it("is a real DELETE, not a flag: a discarded session is a different thing", () => {
    const { db, store } = fresh();
    store.hydrate(T0);
    store.start("run", T0);
    store.discardLive(T0 + 1_000);
    // Discard keeps the rows and marks them.
    expect(countRows(db, "events")).toBe(2);
    expect(store.summaries()[0]!.discarded).toBe(true);
    const id = store.summaries()[0]!.session.id;
    store.deleteSession(id);
    expect(countRows(db, "events")).toBe(0);
  });
});
