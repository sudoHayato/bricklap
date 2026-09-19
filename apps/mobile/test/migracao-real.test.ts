import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { blocksFromEvents, roundsFromEvents, blockRecord, segmentsFromEvents, sessionMetrics } from "@bricklap/engine";
import { SqliteSessionStore, migrate, readSchemaVersion, replaySessions, type EventRow, type SampleRow } from "../persistence";
import { openNodeDb } from "./helpers/node-db";

/**
 * The migration to schema v4, proven against the founder's REAL database
 * (ADR 0011, session 26) — not against invented rows. Runs only when
 * BRICKLAP_DB points at a copy of `bricklap.db` pulled off the phone (with
 * its -wal next to it); the copy is duplicated into a temp dir first, so
 * the pulled file is never written to. Skipped otherwise, so `npm test`
 * stays green on a machine without the phone's data. The numbers it prints
 * are the ones the session 26 report quotes.
 */

const source = process.env["BRICKLAP_DB"];

describe.skipIf(!source || !existsSync(source))("migração v3 → v4 sobre a base real do telemóvel", () => {
  it("keeps every session, event and sample byte for byte, and the end door then writes to a real workout", () => {
    const dir = mkdtempSync(join(tmpdir(), "bricklap-migracao-"));
    const copy = join(dir, basename(source!));
    copyFileSync(source!, copy);
    for (const suffix of ["-wal", "-shm"]) if (existsSync(source + suffix)) copyFileSync(source + suffix, copy + suffix);

    // Before: read the rows with the old SELECTs (no payload column yet).
    const db = openNodeDb(copy);
    const from = readSchemaVersion(db);
    if (from >= 4) {
      // A base pulled after session 26 is already v4: there is nothing to cross, and this proof is about crossing.
      // `leitura-real` and `taxonomia-real` are the ones that read a v4 base.
      console.log(`BRICKLAP_MIGRACAO ${JSON.stringify({ schema: `${from} (already migrated)` })}`);
      return;
    }
    const eventsBefore = db.raw.prepare("SELECT seq, session_id, type, at, sport, discarded FROM events ORDER BY seq").all() as Omit<EventRow, "payload">[];
    const samplesBefore = db.raw.prepare("SELECT seq, session_id, t, lat, lng, speed_mps, source, accuracy FROM samples ORDER BY seq").all() as (SampleRow & { seq: number })[];
    const sessionsBefore = replaySessions(
      eventsBefore.map((e) => ({ ...e, payload: null })),
      samplesBefore,
    );

    const crossed = migrate(db);
    expect(crossed).toEqual({ from, to: 4 });
    expect(readSchemaVersion(db)).toBe(4);
    expect((db.raw.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check).toBe("ok");

    // After: the same rows, same seqs, payload NULL everywhere.
    const eventsAfter = db.raw.prepare("SELECT seq, session_id, type, at, sport, discarded, payload FROM events ORDER BY seq").all() as EventRow[];
    const samplesAfter = db.raw.prepare("SELECT seq, session_id, t, lat, lng, speed_mps, source, accuracy FROM samples ORDER BY seq").all();
    expect(eventsAfter.map(({ payload, ...rest }) => rest)).toEqual(eventsBefore);
    expect(eventsAfter.every((e) => e.payload === null)).toBe(true);
    expect(samplesAfter).toEqual(samplesBefore);

    // The store opens it, finds no live session, and replays every session identically.
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    expect(store.hydrate()).toBeNull();
    const sessionsAfter = store.loadAll();
    expect(sessionsAfter).toEqual(sessionsBefore);
    expect(sessionsAfter.every((s) => blocksFromEvents(s.session.events).every((b) => b.round === null))).toBe(true);
    expect(sessionsAfter.every((s) => roundsFromEvents(s.session.events).length === 0)).toBe(true);

    // The founder's workout 03 (2026-09-18): ten blocks, the end door records a treadmill speed on block 0.
    const workout = sessionsAfter.find((s) => s.session.id === "mu6v59lz-jzfadg");
    const summary = {
      schema: `${from} → 4`,
      sessions: sessionsAfter.length,
      events: eventsAfter.length,
      samples: samplesAfter.length,
      workout03: workout
        ? { blocks: blocksFromEvents(workout.session.events).length, segments: segmentsFromEvents(workout.session.events).length, durationMs: sessionMetrics(workout.session).durationMs }
        : null,
    };
    if (workout) {
      expect(store.record(workout.session.id, { block: 0, origin: "declared", values: { speedKmh: 10 } }, Date.now())).toBe(true);
      const again = store.byId(workout.session.id)!;
      expect(again.events).toHaveLength(workout.session.events.length + 1);
      expect(blockRecord(again.events, 0).values.speedKmh?.value).toBe(10);
      expect(blocksFromEvents(again.events)).toEqual(blocksFromEvents(workout.session.events));
      expect(db.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE payload IS NOT NULL").get()).toEqual({ n: 1 });
    }
    console.log(`BRICKLAP_MIGRACAO ${JSON.stringify(summary)}`);
  });
});
