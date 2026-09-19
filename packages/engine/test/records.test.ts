import { describe, expect, it } from "vitest";
import {
  applyChange,
  applyMark,
  applyRecord,
  applyRoundStart,
  applyStop,
  blockFigures,
  blockRecord,
  blockRecords,
  blocksFromEvents,
  createLiveSession,
  exerciseAcrossRounds,
  exerciseKey,
  exercisesUsed,
  segmentsFromEvents,
  type Session,
  type SessionEvent,
} from "../src";
import { makeSession } from "./helpers";

/**
 * Recorded values (ADR 0011, §2 to §5): both doors append the same event;
 * a correction is a later event, never an edit; the last value per field
 * wins; fields a sport does not carry are dropped; declared and measured
 * stay apart. And the one that matters most for the founder's circuits:
 * blocks compare across rounds by exercise identity, never by position.
 */

const MIN = 60_000;

/** The founder's HIIT shape: rounds of rowing + two exercises, as blocks. */
function circuit(): Session {
  let s = createLiveSession("rowing_indoor", 0);
  s = applyRoundStart(s, 0);
  s = applyChange(s, "strength", 3 * MIN); // block 1: push-ups
  s = applyMark(s, 4 * MIN); // block 2: RDL
  s = applyRoundStart(s, 5 * MIN); // round 2 starts mid-strength: block 3 opens
  s = applyChange(s, "rowing_indoor", 5 * MIN + 1); // block 4; block 3 lasted 1 ms, on purpose: a round can open mid-block
  return s;
}

describe("exerciseKey — a identidade de exercício", () => {
  it("trims, lowercases and collapses spaces; empty is no identity", () => {
    expect(exerciseKey("  Push  Ups ")).toBe("push ups");
    expect(exerciseKey("RDL")).toBe("rdl");
    expect(exerciseKey("")).toBeNull();
    expect(exerciseKey("   ")).toBeNull();
    expect(exerciseKey(null)).toBeNull();
    expect(exerciseKey(undefined)).toBeNull();
  });
});

describe("applyRecord — a única escrita das duas portas", () => {
  it("appends a recorded event with the fields the block's sport carries", () => {
    const s = createLiveSession("rowing_indoor", 0);
    const next = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500, splitS: 112 } }, 2 * MIN);
    expect(next).not.toBe(s);
    expect(next.events.at(-1)).toEqual({
      type: "recorded",
      at: 2 * MIN,
      block: 0,
      origin: "declared",
      values: { meters: 500, splitS: 112 },
    });
    expect(s.events).toHaveLength(2);
  });

  it("drops fields the sport does not carry — reps on a rowing block are a typo — and is a no-op when nothing remains", () => {
    const s = createLiveSession("rowing_indoor", 0);
    const mixed = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500, reps: 10 } }, MIN);
    expect((mixed.events.at(-1) as { values: unknown }).values).toEqual({ meters: 500 });
    expect(applyRecord(s, { block: 0, origin: "declared", values: { reps: 10, loadKg: 20 } }, MIN)).toBe(s);
    // A GPS sport declares nothing: its distance is measured.
    const run = createLiveSession("run", 0);
    expect(applyRecord(run, { block: 0, origin: "declared", values: { meters: 5000 } }, MIN)).toBe(run);
  });

  it("drops non-finite numbers but keeps null, which clears", () => {
    const s = createLiveSession("strength", 0);
    const next = applyRecord(s, { block: 0, origin: "declared", values: { reps: NaN, loadKg: null } }, MIN);
    expect((next.events.at(-1) as { values: unknown }).values).toEqual({ loadKg: null });
    expect(applyRecord(s, { block: 0, origin: "declared", values: { reps: Infinity } }, MIN)).toBe(s);
  });

  it("is a no-op for a block that does not exist", () => {
    const s = createLiveSession("strength", 0);
    expect(applyRecord(s, { block: 1, origin: "declared", values: { reps: 10 } }, MIN)).toBe(s);
    expect(applyRecord(s, { block: -1, origin: "declared", values: { reps: 10 } }, MIN)).toBe(s);
  });

  it("an exercise identity alone is worth writing; a blank one is not", () => {
    const s = createLiveSession("strength", 0);
    const named = applyRecord(s, { block: 0, origin: "declared", exercise: " Push ups " }, MIN);
    expect(named.events.at(-1)).toEqual({ type: "recorded", at: MIN, block: 0, origin: "declared", exercise: "Push ups", values: {} });
    expect(applyRecord(s, { block: 0, origin: "declared", exercise: "   " }, MIN)).toBe(s);
    expect(applyRecord(s, { block: 0, origin: "declared" }, MIN)).toBe(s);
  });

  it("is accepted on a STOPPED session — the end door opens after stopped", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyStop(s, 3 * MIN);
    const next = applyRecord(s, { block: 0, origin: "declared", values: { speedKmh: 10 } }, 20 * MIN);
    expect(next).not.toBe(s);
    expect(next.status).toBe("stopped");
    expect(next.events.map((e) => e.type)).toEqual(["started", "round_started", "stopped", "recorded"]);
    // And it changes nothing the session already derived.
    expect(segmentsFromEvents(next.events)).toEqual(segmentsFromEvents(s.events));
    expect(blocksFromEvents(next.events)).toEqual(blocksFromEvents(s.events));
  });

  it("uses the current time by default", () => {
    const before = Date.now();
    const next = applyRecord(createLiveSession("strength", before - 10_000), { block: 0, origin: "declared", values: { reps: 8 } });
    const at = (next.events.at(-1) as { at: number }).at;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});

describe("blockRecords — vale o último valor registado", () => {
  it("replays per field: the last recorded wins, earlier ones stay in the log", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 480, splitS: 115 } }, MIN); // during
    s = applyStop(s, 3 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500 } }, 10 * MIN); // correction at the end
    expect(s.events.filter((e) => e.type === "recorded")).toHaveLength(2); // nothing rewritten
    expect(blockRecord(s.events, 0)).toEqual({
      exercise: null,
      kind: null,
      values: {
        meters: { value: 500, origin: "declared", at: 10 * MIN },
        splitS: { value: 115, origin: "declared", at: MIN },
      },
    });
  });

  it("null clears a field, and a later value brings it back", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", values: { reps: 10, loadKg: 20 } }, MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { loadKg: null } }, 2 * MIN);
    expect(blockRecord(s.events, 0).values).toEqual({ reps: { value: 10, origin: "declared", at: MIN } });
    s = applyRecord(s, { block: 0, origin: "declared", values: { loadKg: 22.5 } }, 3 * MIN);
    expect(blockRecord(s.events, 0).values.loadKg).toEqual({ value: 22.5, origin: "declared", at: 3 * MIN });
  });

  it("the exercise is the last one named; a record without one leaves it alone", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "flexões", values: { reps: 10 } }, MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { reps: 12 } }, 2 * MIN);
    expect(blockRecord(s.events, 0).exercise).toBe("flexões");
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "push ups" }, 3 * MIN);
    expect(blockRecord(s.events, 0).exercise).toBe("push ups");
  });

  it("a block nobody recorded is absent from the map and empty on its own", () => {
    const s = applyMark(createLiveSession("strength", 0), MIN);
    expect(blockRecords(s.events).size).toBe(0);
    expect(blockRecord(s.events, 1)).toEqual({ exercise: null, kind: null, values: {} });
  });

  it("keeps each block's origin apart: a measured value and a declared one on different blocks", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyMark(s, 5 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 800 } }, 6 * MIN);
    s = applyRecord(s, { block: 1, origin: "measured", values: { meters: 810 } }, 7 * MIN);
    const records = blockRecords(s.events);
    expect(records.get(0)!.values.meters!.origin).toBe("declared");
    expect(records.get(1)!.values.meters!.origin).toBe("measured");
  });
});

describe("blockFigures — o que um bloco mostra, registado e derivado", () => {
  it("rowing: metres as recorded, split derived from metres and time when the machine gave none", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyMark(s, 2 * MIN); // block 0 lasts 120 s
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500 } }, 2 * MIN);
    const f = blockFigures(s, blocksFromEvents(s.events)[0]!);
    expect(f.meters).toEqual({ value: 500, origin: "declared", derived: false });
    expect(f.splitS).toEqual({ value: 120, origin: "declared", derived: true }); // 120 s per 500 m
  });

  it("rowing: the machine's split, when recorded, is shown as recorded and not overridden", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyMark(s, 2 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500, splitS: 112 } }, 2 * MIN);
    expect(blockFigures(s, blocksFromEvents(s.events)[0]!).splitS).toEqual({ value: 112, origin: "declared", derived: false });
  });

  it("rowing: no split without metres, and none for zero metres", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyMark(s, 2 * MIN);
    expect(blockFigures(s, blocksFromEvents(s.events)[0]!)).toEqual({});
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 0 } }, 2 * MIN);
    const f = blockFigures(s, blocksFromEvents(s.events)[0]!);
    expect(f.meters?.value).toBe(0);
    expect(f.splitS).toBeUndefined();
  });

  it("treadmill: km/h recorded → metres derived from the block's time, and the other way round", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyMark(s, 3 * MIN); // block 0: 180 s
    s = applyMark(s, 6 * MIN); // block 1: 180 s
    s = applyRecord(s, { block: 0, origin: "declared", values: { speedKmh: 12 } }, 3 * MIN);
    s = applyRecord(s, { block: 1, origin: "declared", values: { meters: 500 } }, 6 * MIN);
    const [b0, b1] = blocksFromEvents(s.events);
    const f0 = blockFigures(s, b0!);
    expect(f0.speedKmh).toEqual({ value: 12, origin: "declared", derived: false });
    expect(f0.meters).toEqual({ value: 600, origin: "declared", derived: true }); // 12 km/h × 180 s
    const f1 = blockFigures(s, b1!);
    expect(f1.meters).toEqual({ value: 500, origin: "declared", derived: false });
    expect(f1.speedKmh!.derived).toBe(true);
    expect(f1.speedKmh!.value).toBeCloseTo(10, 6); // 500 m in 180 s
  });

  it("treadmill: both recorded → both shown as recorded, nothing derived", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyMark(s, 3 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { speedKmh: 12, meters: 550 } }, 3 * MIN);
    const f = blockFigures(s, blocksFromEvents(s.events)[0]!);
    expect(f.speedKmh!.derived).toBe(false);
    expect(f.meters!.derived).toBe(false);
  });

  it("treadmill: an open block of no duration derives nothing", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyRecord(s, { block: 0, origin: "declared", values: { speedKmh: 12 } }, 0);
    const f = blockFigures(s, blocksFromEvents(s.events)[0]!, 0);
    expect(f.meters).toBeUndefined();
  });

  it("exercises: repetitions and load as recorded", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "RDL", values: { reps: 10, loadKg: 20 } }, MIN);
    expect(blockFigures(s, blocksFromEvents(s.events)[0]!)).toEqual({
      reps: { value: 10, origin: "declared", derived: false },
      loadKg: { value: 20, origin: "declared", derived: false },
    });
  });
});

describe("exerciseAcrossRounds — comparar por identidade, nunca por posição", () => {
  /**
   * Round 1: push-ups, RDL, curls. Round 2: push-ups, curls (RDL skipped).
   * By position, "block 2 of the round" is RDL in round 1 and curls in
   * round 2 — the comparison the ADR forbids. By identity it lines up.
   */
  function twoRounds(): Session {
    let s = createLiveSession("strength", 0);
    s = applyRoundStart(s, 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "Push ups", values: { reps: 10 } }, MIN);
    s = applyMark(s, MIN);
    s = applyRecord(s, { block: 1, origin: "declared", exercise: "RDL", values: { reps: 10, loadKg: 20 } }, 2 * MIN);
    s = applyMark(s, 2 * MIN);
    s = applyRecord(s, { block: 2, origin: "declared", exercise: "Curls", values: { reps: 12, loadKg: 8 } }, 3 * MIN);
    s = applyRoundStart(s, 3 * MIN);
    s = applyRecord(s, { block: 3, origin: "declared", exercise: "push ups", values: { reps: 8 } }, 4 * MIN);
    s = applyMark(s, 4 * MIN);
    s = applyRecord(s, { block: 4, origin: "declared", exercise: "curls", values: { reps: 12, loadKg: 8 } }, 5 * MIN);
    s = applyStop(s, 5 * MIN);
    return s;
  }

  it("lines up the same exercise across rounds even when a round skipped one", () => {
    const s = twoRounds();
    const curls = exerciseAcrossRounds(s, "CURLS");
    expect(curls.map((c) => [c.round, c.block.index, c.figures.reps!.value])).toEqual([
      [0, 2, 12],
      [1, 4, 12],
    ]);
    const rdl = exerciseAcrossRounds(s, "rdl");
    expect(rdl.map((r) => [r.round, r.block.index])).toEqual([[0, 1]]); // done once, not "block 2 of round 2"
    const pushUps = exerciseAcrossRounds(s, "push ups");
    expect(pushUps.map((p) => p.figures.reps!.value)).toEqual([10, 8]);
    // Position would have paired curls (round 2, position 2) with RDL (round 1, position 2).
    const round1 = blocksFromEvents(s.events).filter((b) => b.round === 0);
    const round2 = blocksFromEvents(s.events).filter((b) => b.round === 1);
    expect(blockRecord(s.events, round1[1]!.index).exercise).toBe("RDL");
    expect(blockRecord(s.events, round2[1]!.index).exercise).toBe("curls");
  });

  it("returns nothing for a blank name or one nobody recorded", () => {
    const s = twoRounds();
    expect(exerciseAcrossRounds(s, "  ")).toEqual([]);
    expect(exerciseAcrossRounds(s, "burpees")).toEqual([]);
  });

  it("exercisesUsed lists distinct identities in order of first use, first spelling kept", () => {
    expect(exercisesUsed(twoRounds().events)).toEqual(["Push ups", "RDL", "Curls"]);
    expect(exercisesUsed([])).toEqual([]);
    const blank: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "recorded", at: 1, block: 0, origin: "declared", values: { reps: 1 } },
    ];
    expect(exercisesUsed(blank)).toEqual([]);
  });
});

describe("o treino real: bloco com GPS e bloco declarado na mesma sessão", () => {
  it("a run measured by GPS followed by a circuit with declared values, and a correction after the end", () => {
    // Workout 02's shape: run (GPS), then strength in rounds, with values.
    let s = createLiveSession("run", 0);
    s = applyChange(s, "strength", 20 * MIN);
    s = applyRoundStart(s, 20 * MIN);
    s = applyRecord(s, { block: 1, origin: "declared", exercise: "flexões", values: { reps: 10 } }, 21 * MIN);
    s = applyMark(s, 21 * MIN);
    s = applyChange(s, "rowing_indoor", 22 * MIN); // block 3
    s = applyRecord(s, { block: 3, origin: "declared", values: { meters: 480 } }, 24 * MIN);
    s = applyStop(s, 24 * MIN);
    s = applyRecord(s, { block: 3, origin: "declared", values: { meters: 500 } }, 60 * MIN); // the end door
    const blocks = blocksFromEvents(s.events);
    // Round 1 opens with the session (session 27): the run is round 1, the circuit round 2.
    expect(blocks.map((b) => [b.sport, b.round])).toEqual([
      ["run", 0],
      ["strength", 1],
      ["strength", 1],
      ["rowing_indoor", 1],
    ]);
    // A declared value never lands on the GPS block, and the GPS block has no figures.
    expect(applyRecord(s, { block: 0, origin: "declared", values: { meters: 3000 } }, 61 * MIN)).toBe(s);
    expect(blockFigures(s, blocks[0]!)).toEqual({});
    expect(blockFigures(s, blocks[3]!).meters!.value).toBe(500);
    expect(blockRecord(s.events, 1)).toEqual({
      exercise: "flexões",
      kind: null,
      values: { reps: { value: 10, origin: "declared", at: 21 * MIN } },
    });
    expect(s.events.filter((e) => e.type === "recorded")).toHaveLength(3);
  });

  it("the circuit helper of this file derives rounds the way the founder counts them", () => {
    const s = circuit();
    expect(blocksFromEvents(s.events).map((b) => [b.sport, b.round])).toEqual([
      ["rowing_indoor", 0],
      ["strength", 0],
      ["strength", 0],
      ["strength", 1],
      ["rowing_indoor", 1],
    ]);
  });
});

describe("makeSession helper still builds the shapes above", () => {
  it("is a plain session", () => {
    expect(makeSession([]).events).toEqual([]);
  });
});
