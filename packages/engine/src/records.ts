import { blockMetrics, blocksFromEvents, isLive, nowMs, sessionBounds } from "./engine";
import {
  VALUE_FIELDS,
  VALUE_FIELDS_BY_SPORT,
  sportHasGps,
  type Block,
  type BlockRecord,
  type RecordedValues,
  type Round,
  type Session,
  type SessionEvent,
  type Sport,
  type ValueField,
  type ValueOrigin,
} from "./types";

/**
 * Rounds and recorded values (ADR 0011, accepted in session 26).
 *
 * Nothing here is stored: a round is derived from `round_started` markers
 * the way a segment is derived from `started` / `sport_changed`, and a
 * block's values are the replay of every `recorded` event that names it.
 * The three rules the ADR fixes live in this file and its tests:
 *
 * 1. blocks compare across rounds by exercise identity, never by position;
 * 2. what the athlete typed (declared) and what a device measured stay
 *    apart, in the events and in every total;
 * 3. an aggregate pace is total time over total distance — never the mean
 *    of the paces.
 */

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

/** Two round starts closer than this are one round: no round lasts 2 s. */
export const ROUND_DEDUPE_MS = 2000;

/** The rounds of a session, in order. Empty when nothing was ever marked. */
export function roundsFromEvents(events: SessionEvent[]): Round[] {
  const rounds: Round[] = [];
  let open: Round | null = null;
  for (const event of events) {
    if (event.type === "round_started") {
      if (open) open.endAt = event.at;
      open = { index: rounds.length, startAt: event.at, endAt: null };
      rounds.push(open);
    } else if (event.type === "stopped" && open) {
      open.endAt = event.at;
    }
  }
  return rounds;
}

/** The blocks of one round, in order. */
export function blocksOfRound(events: SessionEvent[], round: number): Block[] {
  return blocksFromEvents(events).filter((b) => b.round === round);
}

/**
 * "Ronda": start a round at `at`. Ignored on a stopped session, before any
 * block exists, and within `ROUND_DEDUPE_MS` of the previous round start —
 * the double fire of a button, which would otherwise leave a block of a
 * second or two standing for a round nobody did. A round start exactly on
 * the block that just opened is legal and creates nothing of ~0 s (see
 * `blocksFromEvents`).
 */
export function applyRoundStart(session: Session, at = nowMs()): Session {
  if (!isLive(session)) return session;
  if (blocksFromEvents(session.events).length === 0) return session;
  const last = lastRoundStart(session.events);
  if (last !== undefined && at - last < ROUND_DEDUPE_MS) return session;
  return { ...session, events: [...session.events, { type: "round_started", at }] };
}

function lastRoundStart(events: SessionEvent[]): number | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "round_started") return e.at;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Recorded values
// ---------------------------------------------------------------------------

/** What a caller hands to `applyRecord`: the block, where the numbers come from, and the numbers. */
export type RecordInput = {
  block: number;
  origin: ValueOrigin;
  exercise?: string;
  values?: RecordedValues;
};

/**
 * The identity two exercises are compared by: the name as the athlete wrote
 * it, trimmed, lowercased and with runs of spaces collapsed. "Flexões" in
 * round 2 and "flexões " in round 4 are the same block. An empty name is
 * no identity at all.
 */
export function exerciseKey(name: string | null | undefined): string | null {
  const key = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return key.length > 0 ? key : null;
}

/**
 * Attach values to a block — the one write both doors share. Accepted on a
 * live AND on a stopped session: completing and correcting at the end is
 * the second door, and it opens after `stopped`. Returns the same reference
 * when there is nothing to write: the block does not exist, or nothing in
 * the input applies to it. Fields the block's sport does not carry
 * (`VALUE_FIELDS_BY_SPORT`) are dropped, not stored — repetitions on a
 * rowing block are a typo, not a value. Non-finite numbers are dropped too;
 * `null` is kept, because it clears a field.
 */
export function applyRecord(session: Session, input: RecordInput, at = nowMs()): Session {
  const block = blocksFromEvents(session.events)[input.block];
  if (!block) return session;
  const allowed = VALUE_FIELDS_BY_SPORT[block.sport];
  const values: RecordedValues = {};
  for (const field of VALUE_FIELDS) {
    if (!allowed.includes(field)) continue;
    const v = input.values?.[field];
    if (v === undefined) continue;
    if (v !== null && !Number.isFinite(v)) continue;
    values[field] = v;
  }
  const exercise = exerciseKey(input.exercise) === null ? undefined : input.exercise!.trim();
  if (exercise === undefined && Object.keys(values).length === 0) return session;
  const event: SessionEvent = {
    type: "recorded",
    at,
    block: input.block,
    origin: input.origin,
    ...(exercise === undefined ? {} : { exercise }),
    values,
  };
  return { ...session, events: [...session.events, event] };
}

/**
 * The values of every block after replay: for each field the last value
 * recorded wins and `null` clears; the exercise is the last one named.
 * Indexed by block; a block nobody recorded is absent.
 */
export function blockRecords(events: SessionEvent[]): Map<number, BlockRecord> {
  const records = new Map<number, BlockRecord>();
  for (const event of events) {
    if (event.type !== "recorded") continue;
    let record = records.get(event.block);
    if (!record) {
      record = { exercise: null, values: {} };
      records.set(event.block, record);
    }
    if (event.exercise !== undefined) record.exercise = event.exercise;
    for (const field of VALUE_FIELDS) {
      const v = event.values[field];
      if (v === undefined) continue;
      if (v === null) delete record.values[field];
      else record.values[field] = { value: v, origin: event.origin, at: event.at };
    }
  }
  return records;
}

/** The record of one block, or an empty one. */
export function blockRecord(events: SessionEvent[], block: number): BlockRecord {
  return blockRecords(events).get(block) ?? { exercise: null, values: {} };
}

/**
 * A number the block shows, with its provenance: `origin` is where the
 * figure ultimately came from, and `derived` says the app computed it from
 * another field and the block's time rather than reading it recorded. A
 * treadmill distance derived from a declared speed is still declared.
 */
export type Figure = { value: number; origin: ValueOrigin; derived: boolean };

export type BlockFigures = Partial<Record<ValueField, Figure>>;

/**
 * What a block can show, recorded and derived (ADR 0011, §2):
 * - rowing: metres as recorded; the machine's split if given; otherwise a
 *   split derived from metres and the block's time (seconds per 500 m);
 * - treadmill: km/h and metres, whichever was recorded, the other derived
 *   from the block's time — so the athlete types one and reads both;
 * - exercises: repetitions and load, as recorded.
 * A GPS sport shows nothing here: its distance is measured from samples,
 * and `blockMetrics` is where it lives.
 */
export function blockFigures(session: Session, block: Block, at = nowMs()): BlockFigures {
  const record = blockRecord(session.events, block.index);
  const out: BlockFigures = {};
  for (const field of VALUE_FIELDS) {
    const v = record.values[field];
    if (v) out[field] = { value: v.value, origin: v.origin, derived: false };
  }
  const seconds = blockMetrics(session, block, at).durationMs / 1000;
  if (block.sport === "rowing_indoor" && out.meters && !out.splitS && out.meters.value > 0 && seconds > 0) {
    out.splitS = { value: seconds / (out.meters.value / 500), origin: out.meters.origin, derived: true };
  }
  if (block.sport === "treadmill" && seconds > 0) {
    if (out.speedKmh && !out.meters) {
      out.meters = { value: (out.speedKmh.value / 3.6) * seconds, origin: out.speedKmh.origin, derived: true };
    } else if (out.meters && !out.speedKmh) {
      out.speedKmh = { value: (out.meters.value / seconds) * 3.6, origin: out.meters.origin, derived: true };
    }
  }
  return out;
}

/**
 * The same exercise across the rounds of a session (ADR 0011, §1b): every
 * block whose recorded identity matches `exercise`, in order, with its
 * round. This is how "push-ups in round 2" meets "push-ups in round 4" —
 * by identity — and why a round with one exercise fewer still lines up.
 */
export function exerciseAcrossRounds(
  session: Session,
  exercise: string,
  at = nowMs(),
): { block: Block; round: number | null; figures: BlockFigures }[] {
  const key = exerciseKey(exercise);
  if (key === null) return [];
  const records = blockRecords(session.events);
  const out: { block: Block; round: number | null; figures: BlockFigures }[] = [];
  for (const block of blocksFromEvents(session.events)) {
    if (exerciseKey(records.get(block.index)?.exercise) !== key) continue;
    out.push({ block, round: block.round, figures: blockFigures(session, block, at) });
  }
  return out;
}

/** The distinct exercise names recorded in a session, first spelling wins, in order of first use. */
export function exercisesUsed(events: SessionEvent[]): string[] {
  const seen = new Map<string, string>();
  for (const event of events) {
    if (event.type !== "recorded" || event.exercise === undefined) continue;
    const key = exerciseKey(event.exercise);
    if (key !== null && !seen.has(key)) seen.set(key, event.exercise);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/**
 * Seconds per kilometre over a set of legs: total time over total
 * distance (ADR 0011, §6), never the mean of the legs' paces — the two
 * differ whenever the legs differ in length, and the mean hides exactly
 * the slow long one. Null when there is no distance to divide by.
 */
export function paceSecPerKm(legs: readonly { durationMs: number; meters: number }[]): number | null {
  let ms = 0;
  let m = 0;
  for (const leg of legs) {
    if (leg.meters <= 0) continue;
    ms += leg.durationMs;
    m += leg.meters;
  }
  return m > 0 ? ms / 1000 / (m / 1000) : null;
}

export type SportAggregate = {
  sport: Sport;
  blocks: number;
  durationMs: number;
  /** Metres measured by a device — GPS samples, or a recorded value with origin `measured`. */
  measuredM: number;
  /** Metres the athlete declared, including the ones derived from a declared speed. */
  declaredM: number;
  /** Time of the blocks that have a distance, whatever its origin: the numerator of the pace. */
  pacedMs: number;
  /** Total time over total distance of those blocks, in s/km; null without distance. */
  secPerKm: number | null;
};

/**
 * Per sport, over every block of the session: time, distance by origin,
 * and the pace as the ADR defines it. A block without a distance counts
 * its time in `durationMs` but not in the pace — its minutes would only
 * slow down a pace it took no part in.
 */
export function aggregateBySport(session: Session, at = nowMs()): SportAggregate[] {
  const bySport = new Map<Sport, SportAggregate>();
  const legs = new Map<Sport, { durationMs: number; meters: number }[]>();
  for (const block of blocksFromEvents(session.events)) {
    let agg = bySport.get(block.sport);
    if (!agg) {
      agg = { sport: block.sport, blocks: 0, durationMs: 0, measuredM: 0, declaredM: 0, pacedMs: 0, secPerKm: null };
      bySport.set(block.sport, agg);
      legs.set(block.sport, []);
    }
    const metrics = blockMetrics(session, block, at);
    agg.blocks++;
    agg.durationMs += metrics.durationMs;
    let meters = 0;
    if (sportHasGps(block.sport)) {
      meters = metrics.distanceM;
      agg.measuredM += meters;
    } else {
      const figure = blockFigures(session, block, at).meters;
      if (figure) {
        meters = figure.value;
        if (figure.origin === "measured") agg.measuredM += meters;
        else agg.declaredM += meters;
      }
    }
    if (meters > 0) {
      agg.pacedMs += metrics.durationMs;
      legs.get(block.sport)!.push({ durationMs: metrics.durationMs, meters });
    }
  }
  for (const agg of bySport.values()) agg.secPerKm = paceSecPerKm(legs.get(agg.sport)!);
  return [...bySport.values()];
}

/**
 * The session's two distance totals, kept apart on purpose (ADR 0011, §3):
 * what was measured and what was declared never sum into one number.
 */
export function distanceTotals(session: Session, at = nowMs()): { measuredM: number; declaredM: number } {
  let measuredM = 0;
  let declaredM = 0;
  for (const agg of aggregateBySport(session, at)) {
    measuredM += agg.measuredM;
    declaredM += agg.declaredM;
  }
  return { measuredM, declaredM };
}

/** The end of a session for figures that need one: `at` while live, its last event otherwise. */
export function sessionEnd(session: Session, at = nowMs()): number {
  return isLive(session) ? at : sessionBounds(session).end;
}
