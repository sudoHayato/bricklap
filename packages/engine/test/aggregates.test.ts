import { describe, expect, it } from "vitest";
import {
  aggregateBySport,
  applyChange,
  applyMark,
  applyRecord,
  applyStop,
  createLiveSession,
  blockFigures,
  blocksFromEvents,
  derivedOrigin,
  distanceTotals,
  formatPace,
  paceSecPerKm,
  sessionEnd,
  sessionMetrics,
  type Session,
} from "../src";
import { makeSession, track } from "./helpers";

/**
 * Aggregates (ADR 0011, §6): a mean pace is total time over total distance,
 * NEVER the arithmetic mean of the paces; and (§3) declared and measured
 * distance never sum into one number.
 */

const MIN = 60_000;

describe("paceSecPerKm — tempo total sobre distância total", () => {
  it("is total time over total distance, and differs from the mean of the paces", () => {
    const legs = [
      { durationMs: 60_000, meters: 200 }, // 300 s/km
      { durationMs: 100_000, meters: 500 }, // 200 s/km
    ];
    const pace = paceSecPerKm(legs)!;
    expect(pace).toBeCloseTo(160 / 0.7, 6); // 228.57 s/km
    const meanOfPaces = (300 + 200) / 2; // 250 — the wrong one
    expect(pace).not.toBeCloseTo(meanOfPaces, 0);
    expect(pace).toBeLessThan(meanOfPaces); // the long leg was the fast one; the mean hides it
  });

  it("agrees with the engine's own pace formatter, which already divides time by distance", () => {
    const legs = [
      { durationMs: 300_000, meters: 1000 },
      { durationMs: 250_000, meters: 1000 },
    ];
    expect(formatPace(2000, 550_000)).toBe("4:35/km");
    expect(Math.round(paceSecPerKm(legs)!)).toBe(275);
  });

  it("ignores legs without distance and is null when nothing has any", () => {
    expect(paceSecPerKm([{ durationMs: 60_000, meters: 0 }])).toBeNull();
    expect(paceSecPerKm([])).toBeNull();
    expect(paceSecPerKm([{ durationMs: 60_000, meters: 0 }, { durationMs: 60_000, meters: 250 }])).toBe(240);
  });
});

describe("aggregateBySport — por desporto, com a fórmula certa", () => {
  /** Rowing in three rounds with different distances, plus a strength block without distance. */
  function rounds(): Session {
    let s = createLiveSession("rowing_indoor", 0); // block 0: 120 s
    s = applyChange(s, "strength", 2 * MIN); // block 1: 60 s
    s = applyChange(s, "rowing_indoor", 3 * MIN); // block 2: 60 s
    s = applyChange(s, "strength", 4 * MIN); // block 3: 60 s
    s = applyChange(s, "rowing_indoor", 5 * MIN); // block 4: 120 s
    s = applyStop(s, 7 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500 } }, 8 * MIN);
    s = applyRecord(s, { block: 2, origin: "declared", values: { meters: 200 } }, 8 * MIN);
    // block 4 (the last rowing) has no distance recorded
    return s;
  }

  it("sums time and declared distance per sport; the pace is time over distance of the blocks that have one", () => {
    const [rowing, strength] = aggregateBySport(rounds());
    expect(rowing).toEqual({
      sport: "rowing_indoor",
      blocks: 3,
      durationMs: 300_000,
      measured: { meters: 0, pacedMs: 0, secPerKm: null },
      // the 120 s block without metres is out of the pace
      declared: { meters: 700, pacedMs: 180_000, secPerKm: 180 / 0.7 },
    });
    expect(strength).toEqual({
      sport: "strength",
      blocks: 2,
      durationMs: 120_000,
      measured: { meters: 0, pacedMs: 0, secPerKm: null },
      declared: { meters: 0, pacedMs: 0, secPerKm: null },
    });
    // And not the mean of the two block paces (240 and 300 s/km = 270).
    expect(rowing!.declared.secPerKm).not.toBe(270);
  });

  it("a GPS sport measures its distance from the samples, never declares it", () => {
    const s = makeSession(
      [
        { type: "started", at: 0, sport: "run" },
        { type: "stopped", at: 10 * MIN },
      ],
      track(0, 10 * MIN, 1_000, 3), // 3 m per second → 1800 m
    );
    const [run] = aggregateBySport(s);
    expect(run!.declared).toEqual({ meters: 0, pacedMs: 0, secPerKm: null });
    expect(run!.measured.meters).toBeCloseTo(sessionMetrics(s).distanceM, 6);
    expect(run!.measured.meters).toBeGreaterThan(1790);
    expect(run!.measured.pacedMs).toBe(10 * MIN);
    expect(run!.measured.secPerKm).toBeCloseTo((10 * 60) / (run!.measured.meters / 1000), 6);
  });

  it("a declared treadmill speed becomes declared metres; a measured value stays measured; and the two paces never blend", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyMark(s, 3 * MIN); // 180 s at 12 km/h → 600 m, declared (derived)
    s = applyMark(s, 6 * MIN); // 180 s, 500 m measured (a device import, one day)
    s = applyStop(s, 9 * MIN); // 180 s, nothing
    s = applyRecord(s, { block: 0, origin: "declared", values: { speedKmh: 12 } }, 10 * MIN);
    s = applyRecord(s, { block: 1, origin: "measured", values: { meters: 500 } }, 10 * MIN);
    const [treadmill] = aggregateBySport(s);
    expect(treadmill).toMatchObject({ blocks: 3, durationMs: 540_000 });
    expect(treadmill!.declared.meters).toBeCloseTo(600, 6);
    expect(treadmill!.declared.pacedMs).toBe(180_000);
    expect(treadmill!.declared.secPerKm).toBeCloseTo(180 / 0.6, 6); // the pace of a declared distance is declared
    expect(treadmill!.measured).toEqual({ meters: 500, pacedMs: 180_000, secPerKm: 180 / 0.5 });
    // There is no field where 600 declared and 500 measured metres are one number, or their paces one pace.
    expect(JSON.stringify(treadmill)).not.toContain("1100");
  });

  it("a treadmill block whose recorded distance is 0 counts its time but not the pace", () => {
    let s = createLiveSession("treadmill", 0);
    s = applyStop(s, 3 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 0 } }, 4 * MIN);
    const [treadmill] = aggregateBySport(s);
    expect(treadmill).toMatchObject({
      durationMs: 180_000,
      declared: { meters: 0, pacedMs: 0, secPerKm: null },
      measured: { meters: 0, pacedMs: 0, secPerKm: null },
    });
  });

  it("is empty for a session with no blocks", () => {
    expect(aggregateBySport(makeSession([]))).toEqual([]);
  });
});

describe("distanceTotals — medido e declarado nunca somam", () => {
  it("keeps the GPS distance of the run apart from the declared metres of the gym", () => {
    // Workout 02's shape with values: a run on GPS, then rowing with declared metres.
    const samples = track(0, 20 * MIN, 1_000, 3); // ≈ 3600 m
    let s = makeSession([{ type: "started", at: 0, sport: "run" }], samples);
    s = applyChange(s, "rowing_indoor", 20 * MIN);
    s = applyStop(s, 25 * MIN);
    s = applyRecord(s, { block: 1, origin: "declared", values: { meters: 1000 } }, 26 * MIN);
    const totals = distanceTotals(s);
    expect(totals.declaredM).toBe(1000);
    expect(totals.measuredM).toBeCloseTo(sessionMetrics(s).distanceM, 6);
    expect(totals.measuredM).toBeGreaterThan(3500);
    // The old session total never saw the declared metres, and still does not.
    expect(sessionMetrics(s).distanceM).toBeCloseTo(totals.measuredM, 6);
  });

  it("is zero on both sides for a session without distance of any kind", () => {
    const s = applyStop(createLiveSession("strength", 0), 5 * MIN);
    expect(distanceTotals(s)).toEqual({ measuredM: 0, declaredM: 0 });
  });
});

describe("sessionEnd", () => {
  it("is `at` while live and the stop time once stopped", () => {
    const live = createLiveSession("strength", 0);
    expect(sessionEnd(live, 90_000)).toBe(90_000);
    expect(sessionEnd(applyStop(live, 60_000), 90_000)).toBe(60_000);
    const before = Date.now();
    expect(sessionEnd(createLiveSession("strength", before - 1000))).toBeGreaterThanOrEqual(before);
  });
});

/**
 * The rule the CTO wrote into ADR 0011 in session 27: anything derived from
 * a declared value is declared. The pace of session 26's test came out of
 * 450 declared metres and looked exactly like a GPS pace — silently.
 */
describe("derivado de declarado é declarado", () => {
  it("one declared input is enough; only measured inputs give a measured result", () => {
    expect(derivedOrigin("declared")).toBe("declared");
    expect(derivedOrigin("measured")).toBe("measured");
    expect(derivedOrigin("measured", "declared", "measured")).toBe("declared");
    expect(derivedOrigin("measured", "measured")).toBe("measured");
    expect(derivedOrigin()).toBe("measured");
  });

  it("every derived figure of a block carries the origin of what it was derived from", () => {
    let s = createLiveSession("rowing_indoor", 0);
    s = applyChange(s, "treadmill", 2 * MIN);
    s = applyMark(s, 5 * MIN);
    s = applyStop(s, 8 * MIN);
    s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 450 } }, 9 * MIN);
    s = applyRecord(s, { block: 1, origin: "declared", values: { speedKmh: 12 } }, 9 * MIN);
    s = applyRecord(s, { block: 2, origin: "measured", values: { meters: 600 } }, 9 * MIN);
    const [rowing, declaredRun, measuredRun] = blocksFromEvents(s.events);
    expect(blockFigures(s, rowing!).splitS).toMatchObject({ derived: true, origin: "declared" });
    expect(blockFigures(s, declaredRun!).meters).toMatchObject({ derived: true, origin: "declared" });
    expect(blockFigures(s, measuredRun!).speedKmh).toMatchObject({ derived: true, origin: "measured" });
  });

  it("the founder's workout 02 with values: the run's pace is measured, the rowing's is declared, and no total holds both", () => {
    const samples = track(0, 20 * MIN, 1_000, 3); // ≈ 3600 m of GPS
    let s = makeSession([{ type: "started", at: 0, sport: "run" }], samples);
    s = applyChange(s, "rowing_indoor", 20 * MIN);
    s = applyStop(s, 24 * MIN);
    s = applyRecord(s, { block: 1, origin: "declared", values: { meters: 1000 } }, 25 * MIN);
    const [run, rowing] = aggregateBySport(s);
    expect(run!.measured.secPerKm).not.toBeNull();
    expect(run!.declared).toEqual({ meters: 0, pacedMs: 0, secPerKm: null });
    expect(rowing!.measured).toEqual({ meters: 0, pacedMs: 0, secPerKm: null });
    expect(rowing!.declared).toEqual({ meters: 1000, pacedMs: 4 * MIN, secPerKm: 240 });
    const totals = distanceTotals(s);
    expect(Object.keys(totals).sort()).toEqual(["declaredM", "measuredM"]);
    expect(totals.declaredM).toBe(1000);
    expect(totals.measuredM).toBeCloseTo(run!.measured.meters, 6);
  });
});
