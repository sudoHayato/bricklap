import { describe, expect, it } from "vitest";
import {
  applyChange,
  applyMark,
  applyStop,
  blockMetrics,
  blocksFromEvents,
  blocksOfSegment,
  createLiveSession,
  segmentMetrics,
  segmentsFromEvents,
  type SessionEvent,
} from "../src";
import { makeSession, track } from "./helpers";

/**
 * "Marca" (Fase 4): the athlete closes a block without changing sport. The
 * point of these tests is the invariant that lets the event be added without
 * touching anything already shipped — segments do not see it — and the one
 * that lets the summary add up: the blocks of a segment tile it exactly.
 */

describe("blocksFromEvents — os blocos derivados dos eventos", () => {
  it("returns no blocks for an empty log", () => {
    expect(blocksFromEvents([])).toEqual([]);
  });

  it("with no marks at all, a block is its segment", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "run" },
      { type: "sport_changed", at: 10_000, sport: "strength" },
      { type: "stopped", at: 30_000 },
    ];
    const blocks = blocksFromEvents(events);
    const segments = segmentsFromEvents(events);
    expect(blocks).toHaveLength(segments.length);
    expect(blocks.map((b) => [b.startAt, b.endAt])).toEqual([
      [0, 10_000],
      [10_000, 30_000],
    ]);
    expect(blocks.map((b) => b.segmentIndex)).toEqual([0, 1]);
  });

  it("a mark splits the block it lands in and keeps the sport", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 60_000 },
      { type: "marked", at: 150_000 },
      { type: "stopped", at: 200_000 },
    ];
    const blocks = blocksFromEvents(events);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.sport)).toEqual(["strength", "strength", "strength"]);
    expect(blocks.map((b) => [b.startAt, b.endAt])).toEqual([
      [0, 60_000],
      [60_000, 150_000],
      [150_000, 200_000],
    ]);
    expect(blocks.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  it("a mark does NOT create a segment: the segment list is the same with and without it", () => {
    const semMarca: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "sport_changed", at: 100_000, sport: "run" },
      { type: "stopped", at: 200_000 },
    ];
    const comMarcas: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 30_000 },
      { type: "marked", at: 60_000 },
      { type: "sport_changed", at: 100_000, sport: "run" },
      { type: "marked", at: 150_000 },
      { type: "stopped", at: 200_000 },
    ];
    expect(segmentsFromEvents(comMarcas)).toEqual(segmentsFromEvents(semMarca));
    expect(blocksFromEvents(comMarcas)).toHaveLength(5);
  });

  it("every block carries the index of the segment it belongs to", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 10_000 },
      { type: "sport_changed", at: 20_000, sport: "treadmill" },
      { type: "marked", at: 30_000 },
      { type: "marked", at: 40_000 },
      { type: "stopped", at: 50_000 },
    ];
    expect(blocksFromEvents(events).map((b) => b.segmentIndex)).toEqual([0, 0, 1, 1, 1]);
    expect(blocksOfSegment(events, 1).map((b) => b.startAt)).toEqual([20_000, 30_000, 40_000]);
    expect(blocksOfSegment(events, 9)).toEqual([]);
  });

  it("the blocks of a segment tile it end to end", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 25_000 },
      { type: "marked", at: 70_000 },
      { type: "sport_changed", at: 90_000, sport: "run" },
      { type: "stopped", at: 120_000 },
    ];
    for (const segment of segmentsFromEvents(events)) {
      const blocks = blocksOfSegment(events, segment.index);
      expect(blocks[0]!.startAt).toBe(segment.startAt);
      expect(blocks.at(-1)!.endAt).toBe(segment.endAt);
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i - 1]!.endAt).toBe(blocks[i]!.startAt);
      }
    }
  });

  it("only the last block of a live session is open", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 10_000 },
    ];
    const blocks = blocksFromEvents(events);
    expect(blocks.filter((b) => b.endAt === null)).toHaveLength(1);
    expect(blocks.at(-1)!.endAt).toBeNull();
  });

  it("a 'recovered' does not open or close a block", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "recovered", at: 5_000 },
      { type: "marked", at: 10_000 },
    ];
    expect(blocksFromEvents(events).map((b) => [b.startAt, b.endAt])).toEqual([
      [0, 10_000],
      [10_000, null],
    ]);
  });

  it("events before a 'started' are ignored, as they are for segments", () => {
    expect(blocksFromEvents([{ type: "marked", at: 1000 }])).toEqual([]);
    expect(blocksFromEvents([{ type: "stopped", at: 1000 }])).toEqual([]);
    expect(blocksFromEvents([{ type: "sport_changed", at: 1000, sport: "run" }])).toEqual([]);
  });
});

describe("applyMark", () => {
  it("appends a 'marked' event to a live session", () => {
    const s = createLiveSession("strength", 1_000, "s1");
    const next = applyMark(s, 5_000);
    expect(next.events.at(-1)).toEqual({ type: "marked", at: 5_000 });
    expect(next).not.toBe(s);
    expect(s.events).toHaveLength(2);
  });

  it("a stopped session is returned untouched", () => {
    const s = applyStop(createLiveSession("strength", 0), 10_000);
    expect(applyMark(s, 20_000)).toBe(s);
  });

  it("a session with no 'started' is returned untouched", () => {
    const s = makeSession([]);
    expect(applyMark(s, 1_000)).toBe(s);
  });

  it("a mark at or before the open block's start is ignored: no zero-length block", () => {
    const s = applyMark(createLiveSession("strength", 1_000, "s1"), 5_000);
    expect(applyMark(s, 5_000)).toBe(s);
    expect(applyMark(s, 4_999)).toBe(s);
    expect(applyMark(s, 5_001).events).toHaveLength(4);
  });

  it("defaults to the current time", () => {
    const before = Date.now();
    const s = applyMark(createLiveSession("strength", before - 10_000, "s1"));
    expect(s.events.at(-1)!.at).toBeGreaterThanOrEqual(before);
  });

  it("marks and sport changes compose in any order", () => {
    let s = createLiveSession("strength", 0, "s1");
    s = applyMark(s, 10_000);
    s = applyChange(s, "run", 20_000);
    s = applyMark(s, 30_000);
    s = applyStop(s, 40_000);
    expect(blocksFromEvents(s.events).map((b) => [b.sport, b.startAt, b.endAt])).toEqual([
      ["strength", 0, 10_000],
      ["strength", 10_000, 20_000],
      ["run", 20_000, 30_000],
      ["run", 30_000, 40_000],
    ]);
  });
});

describe("blockMetrics", () => {
  it("a block without GPS is time only", () => {
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 60_000 },
      { type: "stopped", at: 100_000 },
    ];
    const s = makeSession(events);
    const [primeiro, segundo] = blocksFromEvents(events);
    expect(blockMetrics(s, primeiro!)).toEqual({ durationMs: 60_000, distanceM: 0, avgSpeedMps: 0 });
    expect(blockMetrics(s, segundo!)).toEqual({ durationMs: 40_000, distanceM: 0, avgSpeedMps: 0 });
  });

  it("the blocks of a GPS segment add up to the segment, in distance and in time", () => {
    // 120 s of running at 1 Hz, 3 m per second, marked twice along the way.
    const events: SessionEvent[] = [
      { type: "started", at: 0, sport: "run" },
      { type: "marked", at: 40_000 },
      { type: "marked", at: 90_000 },
      { type: "stopped", at: 120_000 },
    ];
    const s = makeSession(events, track(0, 120_000, 1_000, 3));
    const segment = segmentsFromEvents(events)[0]!;
    const total = segmentMetrics(s, segment);
    const blocks = blocksOfSegment(events, 0).map((b) => blockMetrics(s, b));
    expect(blocks).toHaveLength(3);
    expect(blocks.reduce((a, m) => a + m.durationMs, 0)).toBe(total.durationMs);
    expect(blocks.reduce((a, m) => a + m.distanceM, 0)).toBeCloseTo(total.distanceM, 6);
    for (const m of blocks) expect(m.distanceM).toBeGreaterThan(0);
  });

  it("an open block of a live session is measured up to `at`", () => {
    const s = makeSession([
      { type: "started", at: 0, sport: "strength" },
      { type: "marked", at: 10_000 },
    ]);
    const aberto = blocksFromEvents(s.events).at(-1)!;
    expect(blockMetrics(s, aberto, 25_000).durationMs).toBe(15_000);
  });

  it("an open block of a stopped session falls back to the session's end", () => {
    // Hand-built: a block left open although the session already stopped.
    const s = makeSession(
      [
        { type: "started", at: 0, sport: "strength" },
        { type: "stopped", at: 50_000 },
      ],
      [],
      "stopped",
    );
    const aberto = { index: 0, segmentIndex: 0, sport: "strength" as const, startAt: 0, endAt: null, round: null };
    expect(blockMetrics(s, aberto, 999_000).durationMs).toBe(50_000);
  });

  it("a block pointing at no segment of these events is time only", () => {
    const s = makeSession([{ type: "started", at: 0, sport: "run" }], track(0, 60_000, 1_000, 3));
    const orfao = { index: 0, segmentIndex: 7, sport: "run" as const, startAt: 0, endAt: 30_000, round: null };
    expect(blockMetrics(s, orfao)).toEqual({ durationMs: 30_000, distanceM: 0, avgSpeedMps: 0 });
  });

  it("avgSpeedMps is 0 for a block of no duration", () => {
    const s = makeSession([{ type: "started", at: 0, sport: "run" }], track(0, 10_000, 1_000, 3));
    const vazio = { index: 0, segmentIndex: 0, sport: "run" as const, startAt: 5_000, endAt: 5_000, round: null };
    expect(blockMetrics(s, vazio).avgSpeedMps).toBe(0);
  });
});
