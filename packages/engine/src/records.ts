import { blockMetrics, blocksFromEvents, isLive, nowMs, roundStartsFromEvents, sessionBounds } from "./engine";
import {
  SEED_EXERCISES,
  exerciseIdentity,
  resolveExercise,
  type CatalogExercise,
  type ExerciseMention,
} from "./exercises";
import {
  EXERCISE_KINDS,
  VALUE_FIELDS,
  VALUE_FIELDS_BY_KIND,
  VALUE_FIELDS_BY_SPORT,
  sportHasGps,
  type Block,
  type BlockRecord,
  type ExerciseKind,
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

/**
 * The rounds of a session, in order. A session created since session 27 has
 * round 1 from its first instant (`createLiveSession`); one recorded before
 * that has only the rounds the athlete marked — often none, and then this
 * is empty. Each round runs to the next one, or to `stopped`.
 */
export function roundsFromEvents(events: SessionEvent[]): Round[] {
  const starts = roundStartsFromEvents(events);
  let stoppedAt: number | null = null;
  for (const event of events) if (event.type === "stopped") stoppedAt = event.at;
  return starts.map((startAt, index) => ({ index, startAt, endAt: starts[index + 1] ?? stoppedAt }));
}

/** The blocks of one round, in order. */
export function blocksOfRound(events: SessionEvent[], round: number): Block[] {
  return blocksFromEvents(events).filter((b) => b.round === round);
}

/**
 * "Nova ronda": start the next round at `at`. Ignored on a stopped session,
 * before any block exists, before the open block began, and within
 * `ROUND_DEDUPE_MS` of the previous round start — the double fire of a
 * button. Since round 1 opens with the session (`createLiveSession`), this
 * is also what keeps a "Nova ronda" pressed right on top of "Iniciar" from
 * saying round 1 twice: nothing is written, and the time stays where it
 * was, in round 1. The guard is on the WRITE — a press that is not written
 * loses nothing — and never on the reading: no block or round is dropped
 * for being short. A round start exactly on the block that just opened is
 * legal and creates nothing of ~0 s (see `blocksFromEvents`).
 */
export function applyRoundStart(session: Session, at = nowMs()): Session {
  if (!isLive(session)) return session;
  const open = blocksFromEvents(session.events).at(-1);
  if (!open || at < open.startAt) return session;
  const last = roundStartsFromEvents(session.events).at(-1);
  if (last !== undefined && at - last < ROUND_DEDUPE_MS) return session;
  return { ...session, events: [...session.events, { type: "round_started", at }] };
}

// ---------------------------------------------------------------------------
// Recorded values
// ---------------------------------------------------------------------------

/** What a caller hands to `applyRecord`: the block, where the numbers come from, and the numbers. */
export type RecordInput = {
  block: number;
  origin: ValueOrigin;
  exercise?: string;
  /** The kind the athlete chose (ADR 0012). Only a `strength` block takes one. */
  kind?: ExerciseKind;
  values?: RecordedValues;
};

/**
 * A name as written, trimmed, lowercased and with runs of spaces collapsed:
 * what tells the ficha that the athlete changed the text. It was the
 * comparison identity until ADR 0012; across rounds blocks now compare by
 * `exerciseIdentity`, which also knows the catalogue and ignores accents.
 * An empty name is no name at all.
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
 * the input applies to it. Fields the block does not carry are dropped, not
 * stored — repetitions on a rowing block are a typo, not a value, and so is
 * a load on a body-weight exercise (`fieldsOfKind`, judged with the name
 * and the kind this same input brings). Non-finite numbers are dropped too;
 * `null` is kept for any field of the sport, because it clears one — and a
 * block that turns from bicep into push-ups has a load to clear.
 */
export function applyRecord(
  session: Session,
  input: RecordInput,
  at = nowMs(),
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): Session {
  const block = blocksFromEvents(session.events)[input.block];
  if (!block) return session;
  const exercise = exerciseKey(input.exercise) === null ? undefined : input.exercise!.trim();
  const kind = block.sport === "strength" && input.kind !== undefined && EXERCISE_KINDS.includes(input.kind) ? input.kind : undefined;
  const before = blockRecord(session.events, input.block);
  const sameExercise = exercise === undefined || exerciseIdentity(exercise) === exerciseIdentity(before.exercise);
  const after = { exercise: exercise ?? before.exercise, kind: kind ?? (sameExercise ? before.kind : null) };
  const settable = fieldsOfKind(block.sport, kindOfRecord(after, catalog));
  const clearable = VALUE_FIELDS_BY_SPORT[block.sport];
  const values: RecordedValues = {};
  for (const field of VALUE_FIELDS) {
    const v = input.values?.[field];
    if (v === undefined) continue;
    if (v === null ? !clearable.includes(field) : !settable.includes(field) || !Number.isFinite(v)) continue;
    values[field] = v;
  }
  if (exercise === undefined && kind === undefined && Object.keys(values).length === 0) return session;
  const event: SessionEvent = {
    type: "recorded",
    at,
    block: input.block,
    origin: input.origin,
    ...(exercise === undefined ? {} : { exercise }),
    ...(kind === undefined ? {} : { kind }),
    values,
  };
  return { ...session, events: [...session.events, event] };
}

/**
 * The fields a block shows (ADR 0012): the sport decides, except in a
 * `strength` block, where the kind of exercise does — free weight is
 * repetitions and load, body weight is repetitions. A strength block of no
 * known kind shows both, exactly as before the taxonomy: nothing that
 * could be recorded yesterday is refused today.
 */
export function fieldsOfKind(sport: Sport, kind: ExerciseKind | null): readonly ValueField[] {
  if (sport !== "strength" || kind === null) return VALUE_FIELDS_BY_SPORT[sport];
  return VALUE_FIELDS_BY_KIND[kind];
}

/** The kind a record amounts to: the one the athlete chose, else the catalogue's for the name written. */
function kindOfRecord(
  record: { exercise: string | null; kind: ExerciseKind | null },
  catalog: readonly CatalogExercise[],
): ExerciseKind | null {
  return record.kind ?? resolveExercise(record.exercise, catalog)?.kind ?? null;
}

/** The kind of a block: null for every sport but `strength`, and for a strength block nobody described. */
export function blockKind(
  events: SessionEvent[],
  block: Block,
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): ExerciseKind | null {
  if (block.sport !== "strength") return null;
  return kindOfRecord(blockRecord(events, block.index), catalog);
}

/** The fields of one block, by its sport and its kind. */
export function fieldsOfBlock(
  events: SessionEvent[],
  block: Block,
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): readonly ValueField[] {
  return fieldsOfKind(block.sport, blockKind(events, block, catalog));
}

/**
 * The sports that are an exercise in themselves: a rowing block is "rowing"
 * whether or not anybody named it. `strength` and `transition` are not —
 * one is a container for exercises, the other is the gap between them.
 */
const SPORT_IS_IDENTITY: Record<Sport, boolean> = {
  run: true,
  bike: true,
  walk: true,
  transition: false,
  strength: false,
  rowing_indoor: true,
  treadmill: true,
  swimming_pool: true,
};

/**
 * What a block IS, for comparing it with the others (ADR 0011 §1b, ADR
 * 0012): the identity of the exercise named on it; without a name, the
 * sport, when the sport is an exercise in itself; otherwise nothing. This
 * is what lines up the rowing of round 2 with the rowing of round 4, and
 * the push-ups with the push-ups, wherever each sat in its round.
 */
export function blockIdentity(
  events: SessionEvent[],
  block: Block,
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): string | null {
  const named = exerciseIdentity(blockRecord(events, block.index).exercise, catalog);
  if (named !== null) return named;
  return SPORT_IS_IDENTITY[block.sport] ? `sport:${block.sport}` : null;
}

/** Every exercise a session names, one mention per block, in block order — what `catalogFromMentions` eats. */
export function exerciseMentions(events: SessionEvent[]): ExerciseMention[] {
  return [...blockRecords(events).entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, record]) => record.exercise !== null)
    .map(([, record]) => ({ exercise: record.exercise, kind: record.kind }));
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
      record = { exercise: null, kind: null, values: {} };
      records.set(event.block, record);
    }
    if (event.exercise !== undefined) {
      // A new name is a new exercise: the kind chosen for the old one does
      // not carry over. The same name written again keeps it.
      if (exerciseIdentity(event.exercise) !== exerciseIdentity(record.exercise)) record.kind = null;
      record.exercise = event.exercise;
    }
    if (event.kind !== undefined) record.kind = event.kind;
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
  return blockRecords(events).get(block) ?? { exercise: null, kind: null, values: {} };
}

/**
 * THE RULE (ADR 0011 §3a, CTO, session 27): anything derived from a
 * declared value is declared. One declared input is enough — a pace is the
 * app's own clock over a distance, and if the athlete typed the distance,
 * the pace is typed too. Every derivation in this file goes through here,
 * so that the origin of a number can never be better than its worst input.
 */
export function derivedOrigin(...inputs: ValueOrigin[]): ValueOrigin {
  return inputs.includes("declared") ? "declared" : "measured";
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
    out.splitS = { value: seconds / (out.meters.value / 500), origin: derivedOrigin(out.meters.origin), derived: true };
  }
  if (block.sport === "treadmill" && seconds > 0) {
    if (out.speedKmh && !out.meters) {
      out.meters = { value: (out.speedKmh.value / 3.6) * seconds, origin: derivedOrigin(out.speedKmh.origin), derived: true };
    } else if (out.meters && !out.speedKmh) {
      out.speedKmh = { value: (out.meters.value / seconds) * 3.6, origin: derivedOrigin(out.meters.origin), derived: true };
    }
  }
  return out;
}

/**
 * The same thing across the rounds of a session (ADR 0011 §1b): every block
 * whose identity (`blockIdentity`) is `identity`, in order, with its round.
 * This is how "push-ups in round 2" meets "push-ups in round 4" — by what
 * the block was, never by where it sat — and why a round with one exercise
 * fewer still lines up.
 */
export function identityAcrossRounds(
  session: Session,
  identity: string,
  at = nowMs(),
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): { block: Block; round: number | null; figures: BlockFigures }[] {
  const out: { block: Block; round: number | null; figures: BlockFigures }[] = [];
  for (const block of blocksFromEvents(session.events)) {
    if (blockIdentity(session.events, block, catalog) !== identity) continue;
    out.push({ block, round: block.round, figures: blockFigures(session, block, at) });
  }
  return out;
}

/** `identityAcrossRounds` for an exercise given by name, in any spelling the catalogue knows. */
export function exerciseAcrossRounds(
  session: Session,
  exercise: string,
  at = nowMs(),
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): { block: Block; round: number | null; figures: BlockFigures }[] {
  const identity = exerciseIdentity(exercise, catalog);
  return identity === null ? [] : identityAcrossRounds(session, identity, at, catalog);
}

/** The distinct exercises named in a session — by identity, so two spellings are one — first spelling wins, in order of first use. */
export function exercisesUsed(events: SessionEvent[]): string[] {
  const seen = new Map<string, string>();
  for (const event of events) {
    if (event.type !== "recorded" || event.exercise === undefined) continue;
    const identity = exerciseIdentity(event.exercise);
    if (identity !== null && !seen.has(identity)) seen.set(identity, event.exercise);
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

/** One origin's share of a sport: its metres, the time of the blocks that have them, and the pace of those alone. */
export type OriginAggregate = {
  meters: number;
  /** Time of the blocks whose distance has this origin: the numerator of the pace. */
  pacedMs: number;
  /** Total time over total distance of those blocks, in s/km; null without distance. */
  secPerKm: number | null;
};

export type SportAggregate = {
  sport: Sport;
  blocks: number;
  durationMs: number;
  /** What a device measured — GPS samples, or a recorded value with origin `measured`. */
  measured: OriginAggregate;
  /**
   * What the athlete declared, including everything derived from it
   * (`derivedOrigin`): metres computed from a declared speed, and the pace
   * itself. Kept apart from `measured` all the way down — there is no
   * field in this type where the two are summed, on purpose.
   */
  declared: OriginAggregate;
};

/**
 * Per sport, over every block of the session: time, and distance and pace
 * BY ORIGIN. A block's distance is measured or declared, never half of
 * each, so each block feeds exactly one side; a sport with both (a rowing
 * block imported from a device next to one typed by hand) gets two paces
 * and no blended one. A block without a distance counts its time in
 * `durationMs` but in neither pace — its minutes would only slow down a
 * pace it took no part in.
 */
export function aggregateBySport(session: Session, at = nowMs()): SportAggregate[] {
  const bySport = new Map<Sport, SportAggregate>();
  const legs = new Map<Sport, Record<ValueOrigin, { durationMs: number; meters: number }[]>>();
  for (const block of blocksFromEvents(session.events)) {
    let agg = bySport.get(block.sport);
    if (!agg) {
      agg = {
        sport: block.sport,
        blocks: 0,
        durationMs: 0,
        measured: { meters: 0, pacedMs: 0, secPerKm: null },
        declared: { meters: 0, pacedMs: 0, secPerKm: null },
      };
      bySport.set(block.sport, agg);
      legs.set(block.sport, { measured: [], declared: [] });
    }
    const metrics = blockMetrics(session, block, at);
    agg.blocks++;
    agg.durationMs += metrics.durationMs;
    let meters = 0;
    let origin: ValueOrigin = "measured";
    if (sportHasGps(block.sport)) {
      meters = metrics.distanceM;
    } else {
      const figure = blockFigures(session, block, at).meters;
      if (figure) {
        meters = figure.value;
        origin = figure.origin;
      }
    }
    if (meters > 0) {
      agg[origin].meters += meters;
      agg[origin].pacedMs += metrics.durationMs;
      legs.get(block.sport)![origin].push({ durationMs: metrics.durationMs, meters });
    }
  }
  for (const agg of bySport.values()) {
    agg.measured.secPerKm = paceSecPerKm(legs.get(agg.sport)!.measured);
    agg.declared.secPerKm = paceSecPerKm(legs.get(agg.sport)!.declared);
  }
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
    measuredM += agg.measured.meters;
    declaredM += agg.declared.meters;
  }
  return { measuredM, declaredM };
}

/** The end of a session for figures that need one: `at` while live, its last event otherwise. */
export function sessionEnd(session: Session, at = nowMs()): number {
  return isLive(session) ? at : sessionBounds(session).end;
}
