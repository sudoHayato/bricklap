import { describe, expect, it } from "vitest";
import {
  ROUND_DEDUPE_MS,
  applyChange,
  applyMark,
  applyRoundStart,
  applyStop,
  blocksFromEvents,
  blocksOfRound,
  createLiveSession,
  roundsFromEvents,
  segmentsFromEvents,
  type SessionEvent,
} from "../src";
import { makeSession } from "./helpers";

/**
 * Rounds (ADR 0011, §1, accepted in session 26): a round is one more marker
 * in the event log, derived like segments and blocks, and it must not touch
 * either — `segmentsFromEvents` reads the same with and without it, and a
 * marker on a fresh block boundary creates nothing of ~0 s.
 */

const MIN = 60_000;

describe("roundsFromEvents — as rondas derivadas dos eventos", () => {
  it("is empty when nothing was ever marked as a round", () => {
    expect(roundsFromEvents([])).toEqual([]);
    expect(
      roundsFromEvents([
        { type: "started", at: 0, sport: "strength" },
        { type: "marked", at: MIN },
        { type: "stopped", at: 2 * MIN },
      ]),
    ).toEqual([]);
  });

  it("each marker opens a round that runs to the next marker, and the last one to the stop", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "rowing_indoor" },
      { type: "round_started", at: 0 },
      { type: "sport_changed", at: 3 * MIN, sport: "strength" },
      { type: "round_started", at: 5 * MIN },
      { type: "sport_changed", at: 5 * MIN, sport: "rowing_indoor" },
      { type: "round_started", at: 10 * MIN },
      { type: "stopped", at: 14 * MIN },
    ];
    expect(roundsFromEvents(events)).toEqual([
      { index: 0, startAt: 0, endAt: 5 * MIN },
      { index: 1, startAt: 5 * MIN, endAt: 10 * MIN },
      { index: 2, startAt: 10 * MIN, endAt: 14 * MIN },
    ]);
  });

  it("the open round of a live session has no end", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "round_started", at: MIN },
    ];
    expect(roundsFromEvents(events)).toEqual([{ index: 0, startAt: MIN, endAt: null }]);
  });
});

describe("blocksFromEvents com rondas — o marcador é fronteira de bloco, menos quando já há uma", () => {
  it("blocks before the first marker belong to no round; the rest carry their round index", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "run" }, // warm-up run, no round
      { type: "sport_changed", at: 20 * MIN, sport: "strength" },
      { type: "round_started", at: 20 * MIN }, // same instant as the CHANGE
      { type: "marked", at: 22 * MIN },
      { type: "round_started", at: 24 * MIN }, // mid-block: splits it
      { type: "marked", at: 26 * MIN },
      { type: "stopped", at: 28 * MIN },
    ];
    const blocks = blocksFromEvents(events);
    expect(blocks.map((b) => [b.startAt, b.endAt, b.round])).toEqual([
      [0, 20 * MIN, null],
      [20 * MIN, 22 * MIN, 0],
      [22 * MIN, 24 * MIN, 0],
      [24 * MIN, 26 * MIN, 1],
      [26 * MIN, 28 * MIN, 1],
    ]);
    expect(blocks.map((b) => b.index)).toEqual([0, 1, 2, 3, 4]);
    // The CHANGE and the round marker at the same instant made ONE block, not a ~0 s one.
    expect(blocks.filter((b) => b.endAt === b.startAt)).toHaveLength(0);
  });

  it("a marker at the exact start of the open block tags it instead of splitting it", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "round_started", at: 0 },
      { type: "stopped", at: 5 * MIN },
    ];
    const blocks = blocksFromEvents(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startAt: 0, endAt: 5 * MIN, round: 0 });
  });

  it("a marker before any block (no started yet) is ignored by the derivation", () => {
    const events: SessionEvent[] = [
      { type: "round_started", at: 0 },
      { type: "started", at: MIN, sport: "strength" },
    ];
    expect(blocksFromEvents(events)).toEqual([
      { index: 0, segmentIndex: 0, sport: "strength", startAt: MIN, endAt: null, round: null },
    ]);
  });

  it("a round marker keeps the segment and its sport: segments read exactly as without it", () => {
    const sem: SessionEvent[] = [
      { type: "started", at: 0, sport: "rowing_indoor" },
      { type: "sport_changed", at: 3 * MIN, sport: "strength" },
      { type: "stopped", at: 8 * MIN },
    ];
    const com: SessionEvent[] = [
      sem[0]!,
      { type: "round_started", at: 0 },
      sem[1]!,
      { type: "round_started", at: 5 * MIN },
      sem[2]!,
    ];
    expect(segmentsFromEvents(com)).toEqual(segmentsFromEvents(sem));
    const blocks = blocksFromEvents(com);
    expect(blocks.map((b) => [b.segmentIndex, b.sport, b.round])).toEqual([
      [0, "rowing_indoor", 0],
      [1, "strength", 0],
      [1, "strength", 1],
    ]);
  });

  it("a session recorded before rounds existed derives the same blocks, each with round null", () => {
    // The founder's workout 03 shape: ten alternating segments, no marks, no rounds.
    const events: SessionEvent[] = [{ type: "started", at: 0, sport: "treadmill" }];
    for (let i = 1; i < 10; i++) events.push({ type: "sport_changed", at: i * 3 * MIN, sport: i % 2 ? "strength" : "treadmill" });
    events.push({ type: "stopped", at: 30 * MIN });
    const blocks = blocksFromEvents(events);
    expect(blocks).toHaveLength(10);
    expect(blocks.every((b) => b.round === null)).toBe(true);
    expect(roundsFromEvents(events)).toEqual([]);
  });

  it("blocksOfRound lists the blocks of one round, in order", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "round_started", at: 0 },
      { type: "marked", at: MIN },
      { type: "round_started", at: 2 * MIN },
      { type: "marked", at: 3 * MIN },
      { type: "stopped", at: 4 * MIN },
    ];
    expect(blocksOfRound(events, 0).map((b) => b.index)).toEqual([0, 1]);
    expect(blocksOfRound(events, 1).map((b) => b.index)).toEqual([2, 3]);
    expect(blocksOfRound(events, 7)).toEqual([]);
  });
});

describe("applyRoundStart — a transição", () => {
  it("appends a round_started to a live session", () => {
    const s = createLiveSession("strength", 0);
    const next = applyRoundStart(s, MIN);
    expect(next).not.toBe(s);
    expect(next.events.at(-1)).toEqual({ type: "round_started", at: MIN });
    expect(s.events).toHaveLength(1); // input untouched
  });

  it("is a no-op on a stopped session", () => {
    const s = applyStop(createLiveSession("strength", 0), MIN);
    expect(applyRoundStart(s, 2 * MIN)).toBe(s);
  });

  it("is a no-op when no block exists yet", () => {
    const s = makeSession([]);
    expect(applyRoundStart(s, MIN)).toBe(s);
  });

  it("ignores a second start within ROUND_DEDUPE_MS of the previous one (the double fire)", () => {
    const s = applyRoundStart(createLiveSession("strength", 0), MIN);
    expect(applyRoundStart(s, MIN + ROUND_DEDUPE_MS - 1)).toBe(s);
    const later = applyRoundStart(s, MIN + ROUND_DEDUPE_MS);
    expect(later).not.toBe(s);
    expect(roundsFromEvents(later.events)).toHaveLength(2);
  });

  it("a round start at the instant of a CHANGE is legal and makes no ~0 s block", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyChange(s, "strength", 3 * MIN);
    s = applyRoundStart(s, 3 * MIN);
    s = applyMark(s, 4 * MIN);
    const blocks = blocksFromEvents(s.events);
    expect(blocks.map((b) => [b.sport, b.startAt, b.endAt, b.round])).toEqual([
      ["rowing_indoor", 0, 3 * MIN, null],
      ["strength", 3 * MIN, 4 * MIN, 0],
      ["strength", 4 * MIN, null, 0],
    ]);
  });

  it("uses the current time by default", () => {
    const before = Date.now();
    const next = applyRoundStart(createLiveSession("strength", before - 10_000));
    const at = (next.events.at(-1) as { at: number }).at;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});
