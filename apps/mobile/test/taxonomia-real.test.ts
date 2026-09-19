import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blockIdentity,
  blockKind,
  blockRecord,
  blocksFromEvents,
  fieldsOfBlock,
  resolveExercise,
  roundsFromEvents,
} from "@bricklap/engine";
import { SqliteSessionStore, readSchemaVersion, type EventRow } from "../persistence";
import { openNodeDb } from "./helpers/node-db";

/**
 * Session 27 against the founder's REAL database: the round that opens
 * with the session, and the exercise taxonomy (ADR 0012), on a temp copy of
 * the base pulled off the phone (BRICKLAP_DB). `leitura-real.test.ts`
 * proves the old sessions read the same; this one proves what is new lands
 * next to them without touching them.
 *
 * The taxonomy needs no schema change — the kind travels in the JSON
 * payload the v4 schema already has, and a written name is resolved when
 * it is read, never rewritten. So "migration" here means: the names that
 * were typed before the taxonomy existed still read, and map where they
 * can. The only names ever typed on the founder's phone were in the test
 * session of 2026-09-18, deleted that evening at his request; its eight
 * rows are put back here, on the copy only, exactly as the session 26
 * report recorded them.
 */

const source = process.env["BRICKLAP_DB"];

const TEST_SESSION = "mu7a0zb9-17enqv";
const ROWS: [type: string, at: number, sport: string | null, payload: string | null][] = [
  ["started", 1789755185349, "rowing_indoor", null],
  ["round_started", 1789755191725, null, null],
  ["recorded", 1789755218833, null, '{"block":1,"origin":"declared","values":{"meters":500,"splitS":122}}'],
  ["marked", 1789755224418, null, null],
  ["sport_changed", 1789755230818, "strength", null],
  ["recorded", 1789755252726, null, '{"block":3,"origin":"declared","exercise":"bicep","values":{"reps":8,"loadKg":22.5}}'],
  ["stopped", 1789755260336, null, null],
  ["recorded", 1789755267411, null, '{"block":1,"origin":"declared","values":{"meters":450}}'],
];

describe.skipIf(!source || !existsSync(source))("sessão 27 sobre a base real: a ronda 1 e a taxonomia", () => {
  it("names typed before the taxonomy survive and map; a new session opens in round 1; the old rows are not touched", () => {
    const dir = mkdtempSync(join(tmpdir(), "bricklap-taxonomia-"));
    const copy = join(dir, basename(source!));
    copyFileSync(source!, copy);
    for (const suffix of ["-wal", "-shm"]) if (existsSync(source + suffix)) copyFileSync(source + suffix, copy + suffix);
    const db = openNodeDb(copy);
    const select = "SELECT seq, session_id, type, at, sport, discarded, payload FROM events ORDER BY seq";

    const store = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    expect(store.hydrate()).toBeNull();
    const schema = readSchemaVersion(db);
    expect(schema).toBe(4); // no migration this session: the taxonomy fits the v4 payload
    const before = db.raw.prepare(select).all() as EventRow[];
    const sessionsBefore = store.loadAll();
    const namesBefore = before.filter((r) => r.type === "recorded" && r.payload?.includes('"exercise"')).length;

    // 1. The session 26 test session, row for row as it was on the phone.
    if (!before.some((r) => r.session_id === TEST_SESSION)) {
      for (const [type, at, sport, payload] of ROWS) {
        db.raw.prepare("INSERT INTO events (session_id, type, at, sport, discarded, payload) VALUES (?, ?, ?, ?, 0, ?)").run(TEST_SESSION, type, at, sport, payload);
      }
    }
    const old = store.byId(TEST_SESSION)!;
    const blocks = blocksFromEvents(old.events);
    // It was recorded under the session 26 rule — the round pressed 6 s in — and it still reads that way.
    expect(blocks.map((b) => [b.sport, b.endAt! - b.startAt, b.round])).toEqual([
      ["rowing_indoor", 6376, null],
      ["rowing_indoor", 32693, 0],
      ["rowing_indoor", 6400, 0],
      ["strength", 29518, 0],
    ]);
    expect(roundsFromEvents(old.events)).toHaveLength(1);
    // "bicep", typed before there was a catalogue: the text stays, the taxonomy knows what it is.
    expect(blockRecord(old.events, 3).exercise).toBe("bicep");
    expect(resolveExercise("bicep")).toMatchObject({ id: "bicep_haltere", name: "Bicep com haltere", kind: "free_weight" });
    expect(blockIdentity(old.events, blocks[3]!)).toBe("ex:bicep_haltere");
    expect(blockKind(old.events, blocks[3]!)).toBe("free_weight");
    expect(fieldsOfBlock(old.events, blocks[3]!)).toEqual(["reps", "loadKg"]);
    expect(blockRecord(old.events, 3).values.loadKg?.value).toBe(22.5);
    expect(blockIdentity(old.events, blocks[1]!)).toBe("sport:rowing_indoor");
    expect(blockRecord(old.events, 1).values.meters?.value).toBe(450);
    expect(store.exerciseCatalog()[0]).toMatchObject({ id: "bicep_haltere", seed: true });

    // 2. A new session on the same base: round 1 from the first row, "Nova ronda" on top of it writes nothing.
    const t0 = Date.now();
    const id = store.start("strength", t0);
    store.startRound(t0 + 500);
    store.record(id, { block: 0, origin: "declared", exercise: "Flexões", values: { reps: 10, loadKg: 5 } }, t0 + 60_000);
    store.startRound(t0 + 120_000);
    store.record(id, { block: 1, origin: "declared", exercise: "Kettlebell swing", kind: "free_weight", values: { reps: 12, loadKg: 16 } }, t0 + 180_000);
    store.stop(t0 + 240_000);
    const fresh = store.byId(id)!;
    expect(fresh.events.map((e) => e.type)).toEqual(["started", "round_started", "recorded", "round_started", "recorded", "stopped"]);
    expect(blocksFromEvents(fresh.events).map((b) => b.round)).toEqual([0, 1]);
    expect(blockRecord(fresh.events, 0).values).toEqual({ reps: { value: 10, origin: "declared", at: t0 + 60_000 } }); // no load on a body-weight exercise
    expect(store.exerciseCatalog().slice(0, 3).map((e) => e.id)).toEqual(["name:kettlebell swing", "flexoes", "bicep_haltere"]);

    // 3. Every row that was there is still there, byte for byte; every old session replays the same.
    const after = db.raw.prepare(select).all() as EventRow[];
    expect(after.slice(0, before.length)).toEqual(before);
    const oldIds = new Set(sessionsBefore.map((s) => s.session.id));
    expect(store.loadAll().filter((s) => oldIds.has(s.session.id))).toEqual(sessionsBefore);
    expect((db.raw.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check).toBe("ok");

    console.log(
      `BRICKLAP_TAXONOMIA ${JSON.stringify({ schema, sessionsBefore: sessionsBefore.length, eventsBefore: before.length, namesTypedBefore: namesBefore, sessionsAfter: store.loadAll().length })}`,
    );
  });
});
