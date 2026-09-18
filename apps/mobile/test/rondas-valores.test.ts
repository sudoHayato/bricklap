import { describe, expect, it } from "vitest";
import {
  applyRecord,
  applyRoundStart,
  applyStop,
  blockRecord,
  blocksFromEvents,
  createLiveSession,
  roundsFromEvents,
} from "@bricklap/engine";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  SqliteSessionStore,
  eventFromRow,
  migrate,
  parseRecordedPayload,
  payloadOf,
  readSchemaVersion,
  replaySessions,
} from "../persistence";
import { openNodeDb } from "./helpers/node-db";

/**
 * Rounds and recorded values on disk (ADR 0011, schema v4): one nullable
 * `payload` column, two new row types, and the two doors writing the same
 * appended row — on the live session and on a stopped one.
 */

const T0 = 1_760_000_000_000;
const MIN = 60_000;

function countRows(db: ReturnType<typeof openNodeDb>, table: string): number {
  return (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("migration v4 — o payload de um evento (ADR 0011)", () => {
  it("is the current version and adds one nullable text column to events", () => {
    expect(SCHEMA_VERSION).toBe(4);
    const db = openNodeDb();
    migrate(db);
    const cols = db.raw.prepare("PRAGMA table_info(events)").all() as { name: string; type: string; notnull: number }[];
    expect(cols.map((c) => c.name)).toEqual(["seq", "session_id", "type", "at", "sport", "discarded", "payload"]);
    expect(cols.find((c) => c.name === "payload")).toMatchObject({ type: "TEXT", notnull: 0 });
  });

  it("upgrades a v3 database in place: every old row keeps its seq and reads back the same, payload NULL", () => {
    const db = openNodeDb();
    expect(migrate(db, MIGRATIONS.slice(0, 3))).toEqual({ from: 0, to: 3 });
    // A session recorded by the session-17 release: marks and changes, no rounds, no values.
    const rows: [string, string, number, string | null][] = [
      ["w", "started", T0, "treadmill"],
      ["w", "sport_changed", T0 + 3 * MIN, "strength"],
      ["w", "marked", T0 + 4 * MIN, null],
      ["w", "stopped", T0 + 6 * MIN, null],
    ];
    for (const r of rows) db.runSync("INSERT INTO events (session_id, type, at, sport) VALUES (?, ?, ?, ?)", r);
    const before = db.raw.prepare("SELECT seq, session_id, type, at, sport, discarded FROM events ORDER BY seq").all();

    expect(migrate(db)).toEqual({ from: 3, to: 4 });
    expect(readSchemaVersion(db)).toBe(4);
    const after = db.raw.prepare("SELECT seq, session_id, type, at, sport, discarded, payload FROM events ORDER BY seq").all() as Record<string, unknown>[];
    expect(after.map(({ payload, ...rest }) => rest)).toEqual(before);
    expect(after.every((r) => r["payload"] === null)).toBe(true);

    // The store replays it exactly as the old adapter would have, now with round null on every block.
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 + 10 * MIN });
    expect(store.hydrate()).toBeNull();
    const [stored] = store.loadAll();
    expect(stored!.session.events).toEqual([
      { type: "started", at: T0, sport: "treadmill" },
      { type: "sport_changed", at: T0 + 3 * MIN, sport: "strength" },
      { type: "marked", at: T0 + 4 * MIN },
      { type: "stopped", at: T0 + 6 * MIN },
    ]);
    const blocks = blocksFromEvents(stored!.session.events);
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.round === null)).toBe(true);
    expect(roundsFromEvents(stored!.session.events)).toEqual([]);

    // And the end door works on that old session: one appended row with a payload, nothing else touched.
    expect(store.record("w", { block: 0, origin: "declared", values: { speedKmh: 10 } }, T0 + 11 * MIN)).toBe(true);
    const rowsAfter = db.raw.prepare("SELECT seq, type, payload FROM events ORDER BY seq").all() as { seq: number; type: string; payload: string | null }[];
    expect(rowsAfter.slice(0, 4).map((r) => r.payload)).toEqual([null, null, null, null]);
    expect(rowsAfter[4]).toEqual({ seq: 5, type: "recorded", payload: JSON.stringify({ block: 0, origin: "declared", values: { speedKmh: 10 } }) });
    expect(blockRecord(store.byId("w")!.events, 0).values.speedKmh).toEqual({ value: 10, origin: "declared", at: T0 + 11 * MIN });
  });
});

describe("payload — ida e volta, e barulho no que não se reconhece", () => {
  it("payloadOf is null for every event but recorded, and round-trips a recorded one", () => {
    expect(payloadOf({ type: "started", at: T0, sport: "run" })).toBeNull();
    expect(payloadOf({ type: "round_started", at: T0 })).toBeNull();
    expect(payloadOf({ type: "marked", at: T0 })).toBeNull();
    const full = { type: "recorded" as const, at: T0, block: 2, origin: "declared" as const, exercise: "RDL", values: { reps: 10, loadKg: null } };
    expect(parseRecordedPayload(payloadOf(full), 1)).toEqual({ block: 2, origin: "declared", exercise: "RDL", values: { reps: 10, loadKg: null } });
    const bare = { type: "recorded" as const, at: T0, block: 0, origin: "measured" as const, values: { meters: 500 } };
    expect(JSON.parse(payloadOf(bare)!)).toEqual({ block: 0, origin: "measured", values: { meters: 500 } });
    expect(parseRecordedPayload(payloadOf(bare), 1)).toEqual({ block: 0, origin: "measured", values: { meters: 500 } });
  });

  it("eventFromRow rebuilds round_started and recorded rows", () => {
    expect(eventFromRow({ seq: 1, session_id: "a", type: "round_started", at: T0, sport: null, discarded: 0, payload: null })).toEqual({
      type: "round_started",
      at: T0,
    });
    expect(
      eventFromRow({
        seq: 2,
        session_id: "a",
        type: "recorded",
        at: T0,
        sport: null,
        discarded: 0,
        payload: '{"block":1,"origin":"declared","exercise":"flexões","values":{"reps":12}}',
      }),
    ).toEqual({ type: "recorded", at: T0, block: 1, origin: "declared", exercise: "flexões", values: { reps: 12 } });
  });

  it("is loud about a recorded row whose payload the engine would never have written", () => {
    const bad = (payload: string | null) => () => parseRecordedPayload(payload, 9);
    expect(bad(null)).toThrow(/seq=9: recorded payload is missing/);
    expect(bad("{nope")).toThrow(/is not JSON/);
    expect(bad("[1]")).toThrow(/is not an object/);
    expect(bad('"x"')).toThrow(/is not an object/);
    expect(bad('{"origin":"declared","values":{}}')).toThrow(/has no block index/);
    expect(bad('{"block":1.5,"origin":"declared","values":{}}')).toThrow(/has no block index/);
    expect(bad('{"block":-1,"origin":"declared","values":{}}')).toThrow(/has no block index/);
    expect(bad('{"block":0,"origin":"guessed","values":{}}')).toThrow(/has origin "guessed"/);
    expect(bad('{"block":0,"origin":"declared","exercise":7,"values":{}}')).toThrow(/non-string exercise/);
    expect(bad('{"block":0,"origin":"declared"}')).toThrow(/has no values/);
    expect(bad('{"block":0,"origin":"declared","values":[]}')).toThrow(/has no values/);
    expect(bad('{"block":0,"origin":"declared","values":{"watts":200}}')).toThrow(/unknown field "watts"/);
    expect(bad('{"block":0,"origin":"declared","values":{"reps":"ten"}}')).toThrow(/non-numeric reps/);
    expect(() =>
      replaySessions(
        [
          { seq: 1, session_id: "a", type: "started", at: T0, sport: "strength", discarded: 0, payload: null },
          { seq: 2, session_id: "a", type: "recorded", at: T0, sport: null, discarded: 0, payload: "{}" },
        ],
        [],
      ),
    ).toThrow(/seq=2/);
  });
});

describe("SqliteSessionStore — as duas portas", () => {
  function fresh() {
    const db = openNodeDb();
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0, now: () => T0 });
    store.hydrate(T0);
    return { db, store };
  }

  it("startRound writes one round_started row; the engine's refusals write nothing", () => {
    const { db, store } = fresh();
    store.startRound(T0); // no live session: nothing
    expect(countRows(db, "events")).toBe(0);
    const id = store.start("rowing_indoor", T0);
    store.startRound(T0);
    expect(countRows(db, "events")).toBe(2);
    store.startRound(T0 + 500); // within the dedupe window: nothing
    expect(countRows(db, "events")).toBe(2);
    store.startRound(T0 + 3 * MIN);
    expect(countRows(db, "events")).toBe(3);
    const rows = db.raw.prepare("SELECT type, at, sport, payload FROM events ORDER BY seq").all();
    expect(rows).toEqual([
      { type: "started", at: T0, sport: "rowing_indoor", payload: null },
      { type: "round_started", at: T0, sport: null, payload: null },
      { type: "round_started", at: T0 + 3 * MIN, sport: null, payload: null },
    ]);
    expect(roundsFromEvents(store.live()!.events)).toHaveLength(2);
    expect(store.byId(id)!.events).toEqual(store.live()!.events);
  });

  it("record during the workout writes to the live session, in memory and on disk", () => {
    const { db, store } = fresh();
    const id = store.start("rowing_indoor", T0);
    expect(store.record(id, { block: 0, origin: "declared", values: { meters: 500 } }, T0 + 2 * MIN)).toBe(true);
    expect(countRows(db, "events")).toBe(2);
    expect(blockRecord(store.live()!.events, 0).values.meters!.value).toBe(500);
    expect(store.byId(id)!.events).toEqual(store.live()!.events);
    // Nothing to record → nothing written, and the live copy is the same reference.
    const live = store.live();
    expect(store.record(id, { block: 0, origin: "declared", values: { reps: 10 } }, T0 + 3 * MIN)).toBe(false);
    expect(store.record(id, { block: 5, origin: "declared", values: { meters: 10 } }, T0 + 3 * MIN)).toBe(false);
    expect(store.live()).toBe(live);
    expect(countRows(db, "events")).toBe(2);
  });

  it("record after the end writes to a stopped session by id, appending — never rewriting — and replays the last value", () => {
    const { db, store } = fresh();
    const id = store.start("treadmill", T0);
    store.record(id, { block: 0, origin: "declared", values: { speedKmh: 9.5 } }, T0 + MIN); // during: a first reading
    store.stop(T0 + 3 * MIN);
    expect(store.live()).toBeNull();
    expect(store.record(id, { block: 0, origin: "declared", values: { speedKmh: 10 } }, T0 + 20 * MIN)).toBe(true); // the end door
    expect(store.record("nobody", { block: 0, origin: "declared", values: { speedKmh: 10 } }, T0 + 20 * MIN)).toBe(false);
    const rows = db.raw.prepare("SELECT type, payload FROM events ORDER BY seq").all();
    expect(rows).toEqual([
      { type: "started", payload: null },
      { type: "recorded", payload: '{"block":0,"origin":"declared","values":{"speedKmh":9.5}}' },
      { type: "stopped", payload: null },
      { type: "recorded", payload: '{"block":0,"origin":"declared","values":{"speedKmh":10}}' },
    ]);
    const replayed = store.byId(id)!;
    expect(replayed.status).toBe("stopped");
    expect(blockRecord(replayed.events, 0).values.speedKmh).toEqual({ value: 10, origin: "declared", at: T0 + 20 * MIN });
    // The summary list replays the same events (no samples needed).
    expect(store.summaries()[0]!.session.events).toEqual(replayed.events);
  });

  it("replays the exact session the engine built in memory, rounds and values included", () => {
    const { store } = fresh();
    const id = store.start("strength", T0);
    let expected = createLiveSession("strength", T0, id);
    store.startRound(T0);
    expected = applyRoundStart(expected, T0);
    store.record(id, { block: 0, origin: "declared", exercise: "Push ups", values: { reps: 10 } }, T0 + MIN);
    expected = applyRecord(expected, { block: 0, origin: "declared", exercise: "Push ups", values: { reps: 10 } }, T0 + MIN);
    store.stop(T0 + 2 * MIN);
    expected = applyStop(expected, T0 + 2 * MIN);
    store.record(id, { block: 0, origin: "declared", values: { reps: 12, loadKg: null } }, T0 + 5 * MIN);
    expected = applyRecord(expected, { block: 0, origin: "declared", values: { reps: 12, loadKg: null } }, T0 + 5 * MIN);
    expect(store.byId(id)).toEqual(expected);
  });
});
