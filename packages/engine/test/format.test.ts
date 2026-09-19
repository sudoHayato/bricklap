import { describe, expect, it } from "vitest";
import {
  applyMark,
  blockMetrics,
  blocksFromEvents,
  createLiveSession,
  durationMs,
  formatClock,
  formatDay,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeedKmh,
} from "../src";

describe("formatDuration", () => {
  it("mm:ss under an hour, hh:mm:ss from one hour", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(59_999)).toBe("00:59");
    expect(formatDuration(61_000)).toBe("01:01");
    expect(formatDuration(3_600_000)).toBe("01:00:00");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
    expect(formatDuration(36_000_000)).toBe("10:00:00");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-5_000)).toBe("00:00");
  });
});

/**
 * Long stopwatches from an INJECTED clock (sessão 28). The recording screen's
 * 84 px stopwatch has to survive the durations of a real workout, and proving
 * that by waiting an hour on a phone is a wait, not a check: every function
 * here takes the time as a parameter, so a session that started at T0 is
 * read at T0 + 3799 s without anything actually running. What the string
 * looks like, character by character, is the input of the width test in
 * `apps/mobile/test/cronometro.test.ts`.
 */
describe("the stopwatch of a long session, from an injected clock", () => {
  const T0 = 1_789_000_000_000;
  const live = createLiveSession("strength", T0, "long");
  const relogio = (segundos: number) => formatDuration(durationMs(live, T0 + segundos * 1000));

  it("59:59, 1:00:00, 1:03:19 and 9:59:59 read exactly as the screen will draw them", () => {
    expect(relogio(59 * 60 + 59)).toBe("59:59");
    expect(relogio(3600)).toBe("01:00:00");
    expect(relogio(3600 + 3 * 60 + 19)).toBe("01:03:19");
    expect(relogio(9 * 3600 + 59 * 60 + 59)).toBe("09:59:59");
  });

  it("the hour is two digits from the first hour, so 8 characters is the longest a workout gets", () => {
    // 59:59 is 5 characters; 01:00:00 is 8. The jump is the case that matters
    // for a fixed-width box, and it happens at the hour, not gradually.
    expect(relogio(59 * 60 + 59)).toHaveLength(5);
    expect(relogio(3600)).toHaveLength(8);
    expect(relogio(99 * 3600 + 59 * 60 + 59)).toHaveLength(8);
  });

  it("one second either side of the hour", () => {
    expect(relogio(3599)).toBe("59:59");
    expect(relogio(3600)).toBe("01:00:00");
    expect(relogio(3601)).toBe("01:00:01");
  });

  it("a session that started before the clock is read never goes negative", () => {
    expect(formatDuration(durationMs(live, T0 - 5_000))).toBe("00:00");
  });

  it("the open block's time (the card under the stopwatch) counts from its own start, on the same clock", () => {
    // A mark at 10 min: the open block is the second one, and reads the rest.
    const marcada = applyMark(live, T0 + 600_000);
    const aberto = blocksFromEvents(marcada.events).at(-1)!;
    const em = T0 + (3600 + 3 * 60 + 19) * 1000;
    expect(formatDuration(durationMs(marcada, em))).toBe("01:03:19");
    expect(formatDuration(blockMetrics(marcada, aberto, em).durationMs)).toBe("53:19");
  });
});

describe("formatDistance", () => {
  it("metres under 1 km, rounded", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(999.4)).toBe("999 m");
    expect(formatDistance(12.6)).toBe("13 m");
  });

  it("switches to km when the rounded value reaches 1000 (never prints '1000 m')", () => {
    expect(formatDistance(999.5)).toBe("1.00 km");
    expect(formatDistance(999.999)).toBe("1.00 km");
  });

  it("two decimals under 10 km, one decimal from 10 km", () => {
    expect(formatDistance(1_000)).toBe("1.00 km");
    expect(formatDistance(1_234)).toBe("1.23 km");
    expect(formatDistance(9_999)).toBe("10.00 km");
    expect(formatDistance(10_000)).toBe("10.0 km");
    expect(formatDistance(12_345)).toBe("12.3 km");
  });
});

describe("formatPace", () => {
  it("is a dash under 20 m", () => {
    expect(formatPace(0, 60_000)).toBe("—");
    expect(formatPace(19.9, 60_000)).toBe("—");
  });

  it("formats minutes:seconds per km", () => {
    expect(formatPace(1_000, 300_000)).toBe("5:00/km");
    expect(formatPace(2_000, 300_000)).toBe("2:30/km");
    expect(formatPace(1_000, 330_500)).toBe("5:31/km"); // 330.5 s → rounds up
    expect(formatPace(20, 6_000)).toBe("5:00/km");
  });

  it("is a dash for zero duration or slower than 60 min/km", () => {
    expect(formatPace(1_000, 0)).toBe("—");
    expect(formatPace(1_000, 3_600_000)).toBe("60:00/km");
    expect(formatPace(1_000, 3_601_000)).toBe("—");
  });

  it("never renders 60 seconds: 299.6 s/km is 5:00, not 4:60", () => {
    expect(formatPace(1_000, 299_600)).toBe("5:00/km");
    expect(formatPace(1_000, 359_990)).toBe("6:00/km");
    expect(formatPace(1_000, 3_599_900)).toBe("60:00/km");
  });
});

describe("formatSpeedKmh", () => {
  it("is a dash at or below 0.2 m/s and for non-finite input", () => {
    expect(formatSpeedKmh(0)).toBe("—");
    expect(formatSpeedKmh(0.2)).toBe("—");
    expect(formatSpeedKmh(-3)).toBe("—");
    expect(formatSpeedKmh(Number.NaN)).toBe("—");
    expect(formatSpeedKmh(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("converts m/s to km/h with one decimal", () => {
    expect(formatSpeedKmh(0.21)).toBe("0.8 km/h");
    expect(formatSpeedKmh(7.4)).toBe("26.6 km/h");
    expect(formatSpeedKmh(10)).toBe("36.0 km/h");
  });
});

describe("formatClock / formatDay", () => {
  const ts = Date.UTC(2026, 8, 6, 7, 12, 0);

  it("formatClock renders hh:mm for an explicit locale", () => {
    expect(formatClock(ts, "en-GB")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatClock(ts, "pt-PT")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("formatDay renders a short weekday/month/day in the given locale", () => {
    const en = formatDay(ts, "en-GB");
    expect(en).toMatch(/Sun/);
    expect(en).toMatch(/Sep/);
    expect(en).toMatch(/6/);
    const pt = formatDay(ts, "pt-PT");
    expect(pt.length).toBeGreaterThan(0);
    expect(pt).not.toBe(en);
  });

  it("both accept an omitted locale (runtime default)", () => {
    expect(formatClock(ts)).toMatch(/\d/);
    expect(formatDay(ts)).toMatch(/\d/);
  });
});
