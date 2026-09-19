import { copyFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { blockRecords, blocksFromEvents, roundsFromEvents, segmentsFromEvents, sessionMetrics } from "@bricklap/engine";
import { SqliteSessionStore } from "../persistence";
import { openNodeDb } from "./helpers/node-db";

/**
 * Every session of the founder's REAL database, read end to end (session
 * 27). Runs only when BRICKLAP_DB points at a copy of `bricklap.db` pulled
 * off the phone; the copy is duplicated into a temp dir first, so the
 * pulled file is never written to.
 *
 * It writes a digest of everything the app derives from each session —
 * blocks, rounds, segments, duration, distance, recorded values — to
 * BRICKLAP_DIGEST_OUT. The file uses only what the engine already exported
 * before session 27, on purpose: the same file runs on a checkout of
 * `main`, and the two digests are compared. "Old sessions still open and
 * read well" is then a diff with no lines, not a sentence.
 */

const source = process.env["BRICKLAP_DB"];
const out = process.env["BRICKLAP_DIGEST_OUT"];

describe.skipIf(!source || !existsSync(source))("leitura da base real do telemóvel, sessão a sessão", () => {
  it("every session opens, and what it derives is written down to be compared across versions of the engine", () => {
    const dir = mkdtempSync(join(tmpdir(), "bricklap-leitura-"));
    const copy = join(dir, basename(source!));
    copyFileSync(source!, copy);
    for (const suffix of ["-wal", "-shm"]) if (existsSync(source + suffix)) copyFileSync(source + suffix, copy + suffix);

    const db = openNodeDb(copy);
    const store = new SqliteSessionStore(db, { flushIntervalMs: 0 });
    store.hydrate();
    const sessions = store.loadAll();
    const digest = sessions.map(({ session, discarded }) => {
      const metrics = sessionMetrics(session);
      const segments = segmentsFromEvents(session.events);
      expect(segments.reduce((ms, s) => ms + ((s.endAt ?? s.startAt) - s.startAt), 0)).toBe(session.status === "stopped" ? metrics.durationMs : expect.any(Number));
      return {
        id: session.id,
        status: session.status,
        discarded,
        events: session.events.map((e) => e.type),
        samples: session.samples.length,
        blocks: blocksFromEvents(session.events),
        rounds: roundsFromEvents(session.events),
        segments,
        durationMs: metrics.durationMs,
        distanceM: Math.round(metrics.distanceM * 1000) / 1000,
        records: [...blockRecords(session.events).entries()].map(([block, r]) => ({ block, exercise: r.exercise, values: r.values })),
      };
    });
    const summary = {
      sessions: digest.length,
      events: digest.reduce((n, s) => n + s.events.length, 0),
      samples: digest.reduce((n, s) => n + s.samples, 0),
      blocks: digest.reduce((n, s) => n + s.blocks.length, 0),
      withRounds: digest.filter((s) => s.rounds.length > 0).length,
      withRecords: digest.filter((s) => s.records.length > 0).length,
    };
    if (out) writeFileSync(out, JSON.stringify({ summary, digest }, null, 1));
    console.log(`BRICKLAP_LEITURA ${JSON.stringify(summary)}`);
    expect(digest.length).toBeGreaterThan(0);
  });
});
