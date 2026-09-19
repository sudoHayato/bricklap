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

  it("a marker that is not after the round already open is that round said twice: it opens nothing", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "round_started", at: 0 },
      { type: "round_started", at: 0 }, // the same instant, written twice
      { type: "round_started", at: 5 * MIN },
      { type: "round_started", at: 4 * MIN }, // out of order: not after the open round
      { type: "stopped", at: 9 * MIN },
    ];
    expect(roundsFromEvents(events)).toEqual([
      { index: 0, startAt: 0, endAt: 5 * MIN },
      { index: 1, startAt: 5 * MIN, endAt: 9 * MIN },
    ]);
    expect(blocksFromEvents(events).map((b) => [b.startAt, b.endAt, b.round])).toEqual([
      [0, 5 * MIN, 0],
      [5 * MIN, 9 * MIN, 1],
    ]);
  });

  it("a marker before any `started` is not a round, for the rounds as for the blocks", () => {
    const events: SessionEvent[] = [
      { type: "round_started", at: 0 },
      { type: "started", at: MIN, sport: "strength" },
    ];
    expect(roundsFromEvents(events)).toEqual([]);
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
    expect(s.events).toHaveLength(2); // input untouched: `started` and the round 1 it opens
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
    expect(roundsFromEvents(later.events)).toHaveLength(3); // round 1 from the start, then the two pressed
  });

  it("a round start at the instant of a CHANGE is legal and makes no ~0 s block", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyChange(s, "strength", 3 * MIN);
    s = applyRoundStart(s, 3 * MIN);
    s = applyMark(s, 4 * MIN);
    const blocks = blocksFromEvents(s.events);
    expect(blocks.map((b) => [b.sport, b.startAt, b.endAt, b.round])).toEqual([
      ["rowing_indoor", 0, 3 * MIN, 0],
      ["strength", 3 * MIN, 4 * MIN, 1],
      ["strength", 4 * MIN, null, 1],
    ]);
  });

  it("is a no-op for a time before the open block began: a round cannot start in a block that is already closed", () => {
    const s = applyChange(createLiveSession("rowing_indoor", 0), "strength", 3 * MIN);
    expect(applyRoundStart(s, 3 * MIN - 1)).toBe(s);
  });

  it("uses the current time by default", () => {
    const before = Date.now();
    const next = applyRoundStart(createLiveSession("strength", before - 10_000));
    const at = (next.events.at(-1) as { at: number }).at;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});

/**
 * Session 27 (CTO): round 1 opens with "Iniciar". The founder's test of
 * session 26 pressed "Nova ronda" 6 s after starting, because round 1 had
 * to be opened by hand, and that left a 6 s block in no round. The fix is
 * not a duration threshold that swallows short blocks — a legitimate 4 s
 * block would vanish one day — but a session that is in round 1 from its
 * first instant, with no edge cases: nothing to press, nothing to absorb.
 */
describe("a ronda 1 abre com o Iniciar", () => {
  it("a new session is in round 1 from its first millisecond, with one block and nothing of ~0 s", () => {
    const s = createLiveSession("rowing_indoor", 1_000);
    expect(s.events).toEqual([
      { type: "started", at: 1_000, sport: "rowing_indoor" },
      { type: "round_started", at: 1_000 },
    ]);
    expect(roundsFromEvents(s.events)).toEqual([{ index: 0, startAt: 1_000, endAt: null }]);
    expect(blocksFromEvents(s.events)).toEqual([
      { index: 0, segmentIndex: 0, sport: "rowing_indoor", startAt: 1_000, endAt: null, round: 0 },
    ]);
  });

  it("'Nova ronda' right on top of 'Iniciar' writes nothing: round 1 is not said twice and no round is left empty", () => {
    const s = createLiveSession("strength", 0);
    expect(applyRoundStart(s, 0)).toBe(s);
    expect(applyRoundStart(s, 1)).toBe(s);
    expect(applyRoundStart(s, ROUND_DEDUPE_MS - 1)).toBe(s);
    expect(roundsFromEvents(s.events)).toHaveLength(1);
  });

  it("'Nova ronda' pressed later is round 2, by the athlete's hand — and nothing is dropped for being short", () => {
    // 6 s after the start, as in the founder's test. It is a real press with
    // "Ronda 1" already on the screen: the log says what happened, and the
    // 6 s stay where they were lived, in round 1.
    const s = applyStop(applyRoundStart(createLiveSession("rowing_indoor", 0), 6_000), MIN);
    expect(roundsFromEvents(s.events)).toEqual([
      { index: 0, startAt: 0, endAt: 6_000 },
      { index: 1, startAt: 6_000, endAt: MIN },
    ]);
    expect(blocksFromEvents(s.events).map((b) => [b.startAt, b.endAt, b.round])).toEqual([
      [0, 6_000, 0],
      [6_000, MIN, 1],
    ]);
  });

  it("a whole circuit: every block is in a round, and the rounds are numbered from the start", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyChange(s, "strength", 2 * MIN);
    s = applyChange(s, "rowing_indoor", 5 * MIN);
    s = applyRoundStart(s, 5 * MIN); // on the block the Mudar just opened: tags it, splits nothing
    s = applyChange(s, "strength", 7 * MIN);
    s = applyStop(s, 10 * MIN);
    expect(blocksFromEvents(s.events).map((b) => [b.sport, b.round])).toEqual([
      ["rowing_indoor", 0],
      ["strength", 0],
      ["rowing_indoor", 1],
      ["strength", 1],
    ]);
    expect(blocksFromEvents(s.events).filter((b) => b.endAt === b.startAt)).toHaveLength(0);
  });

  it("no sequence of presses leaves a round without a block, a block of ~0 s from a round, or two rounds at one instant", () => {
    // A small deterministic generator: the property has to hold for every
    // order of Mudar, Marca and Nova ronda, at any spacing, including 0 ms.
    let seed = 20260919;
    const next = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    const sports = ["strength", "rowing_indoor", "treadmill", "run"] as const;
    for (let run = 0; run < 300; run++) {
      let at = next(5) * 1_000;
      let s = createLiveSession(sports[next(4)]!, at);
      const steps = 1 + next(12);
      for (let i = 0; i < steps; i++) {
        at += [0, 0, 1, 500, 1_999, 2_000, 6_000, 90_000][next(8)]!;
        const action = next(3);
        if (action === 0) s = applyRoundStart(s, at);
        else if (action === 1) s = applyMark(s, at);
        else s = applyChange(s, sports[next(4)]!, at);
      }
      if (next(2) === 0) s = applyStop(s, at + next(3) * 1_000);
      const rounds = roundsFromEvents(s.events);
      const blocks = blocksFromEvents(s.events);
      expect(rounds[0]?.startAt).toBe(s.createdAt);
      for (let r = 1; r < rounds.length; r++) expect(rounds[r]!.startAt).toBeGreaterThan(rounds[r - 1]!.startAt);
      // every block is in a round, and every round has at least one block
      expect(blocks.every((b) => b.round !== null)).toBe(true);
      expect([...new Set(blocks.map((b) => b.round))]).toEqual(rounds.map((r) => r.index));
      // a round marker never closes a block of 0 ms by itself: the only one
      // that can is a Mudar at the very instant the block opened, as before rounds existed
      // (or a Parar at that instant, which closes whatever is open)
      const closers = s.events.filter((e) => e.type === "sport_changed" || e.type === "stopped").map((e) => e.at);
      expect(blocks.filter((b) => b.endAt === b.startAt && !closers.includes(b.startAt))).toEqual([]);
    }
  });
});
