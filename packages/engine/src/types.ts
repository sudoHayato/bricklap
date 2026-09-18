/**
 * Every sport a segment can be. Outdoor sports are recorded with a position
 * feed; the gym and pool ones are time only (ADR 0008). Order is the order
 * the pickers show them in.
 */
export const SPORTS = [
  "run",
  "bike",
  "walk",
  "transition",
  "strength",
  "rowing_indoor",
  "treadmill",
  "swimming_pool",
] as const;

export type Sport = (typeof SPORTS)[number];

/**
 * Whether a sport is recorded with a position feed. A segment of a sport
 * without one has no samples on purpose: its distance is 0 and it has no
 * pace or speed, whatever samples may sit around it in time.
 */
export const SPORT_HAS_GPS: Record<Sport, boolean> = {
  run: true,
  bike: true,
  walk: true,
  transition: true,
  strength: false,
  rowing_indoor: false,
  treadmill: false,
  swimming_pool: false,
};

export function sportHasGps(sport: Sport): boolean {
  return SPORT_HAS_GPS[sport];
}

export function nextSport(current: Sport): Sport {
  const i = SPORTS.indexOf(current);
  return SPORTS[(i + 1) % SPORTS.length]!;
}

export type SessionEvent =
  | { type: "started"; at: number; sport: Sport }
  | { type: "sport_changed"; at: number; sport: Sport }
  /**
   * "Marca": closes the block that just ended and opens the next one, inside
   * the same segment and without changing sport (Fase 4). It is what makes a
   * gym circuit legible — five sets of the same exercise are five blocks of
   * one strength segment, not five segments — and it is the only event the
   * athlete fires repeatedly during a session.
   */
  | { type: "marked"; at: number }
  /**
   * "Ronda" (ADR 0011, §1): a round starts here. Not a sport and not a new
   * entity — one more marker in the log, from which `roundsFromEvents`
   * derives the rounds the way `segmentsFromEvents` derives the segments.
   * It is also a block boundary, like a mark, unless it lands exactly on
   * one (a CHANGE at the same instant): then the block that just opened is
   * the first of the round, and nothing of ~0 s is created.
   */
  | { type: "round_started"; at: number }
  /**
   * Values the athlete (or, one day, a device import) attached to a block
   * (ADR 0011, §2 to §5): which block, where the numbers came from, an
   * optional exercise identity and the fields themselves. Both doors —
   * during the workout and at the end — append this same event; a
   * correction is a later `recorded` for the same block, never an edit,
   * and the last value recorded for each field is the one that counts.
   * A field set to `null` clears it. The only event accepted on a stopped
   * session, because the end door has to work after `stopped`.
   */
  | {
      type: "recorded";
      at: number;
      /** Index of the block in `blocksFromEvents`, stable because the log is append-only. */
      block: number;
      origin: ValueOrigin;
      /**
       * Identity of the exercise (ADR 0011, §1b): what the block was, not
       * where it sat. Two blocks of different rounds are comparable when
       * they share it; position never decides that. Free text today,
       * compared as written after trimming and lowercasing (`exerciseKey`).
       */
      exercise?: string;
      values: RecordedValues;
    }
  | { type: "stopped"; at: number }
  | { type: "recovered"; at: number };

/**
 * Where a number came from (ADR 0011, §3): typed by the athlete — a
 * treadmill speed read off the machine, a rowing distance, a rep count — or
 * measured by a device. Kept apart in the schema from the first row that
 * stores them, so a declared distance never sums into a measured total: the
 * first personal record would be false otherwise, and the flag cannot be
 * added afterwards without rewriting history. Everything from GPS samples
 * is measured by construction; everything the app writes today is declared.
 */
export type ValueOrigin = "declared" | "measured";

/**
 * The fields a block can carry, by sport (ADR 0011, §2, as accepted):
 * rowing in metres, with the split the machine showed as an optional
 * extra (the app derives its own split from metres and time); treadmill in
 * km/h or distance, the other derived from the block's time; exercises in
 * repetitions and load. Sports with GPS have no declared fields — their
 * distance is measured — and neither has pool swimming yet.
 */
export const VALUE_FIELDS = ["meters", "splitS", "speedKmh", "reps", "loadKg"] as const;

export type ValueField = (typeof VALUE_FIELDS)[number];

export const VALUE_FIELDS_BY_SPORT: Record<Sport, readonly ValueField[]> = {
  run: [],
  bike: [],
  walk: [],
  transition: [],
  strength: ["reps", "loadKg"],
  rowing_indoor: ["meters", "splitS"],
  treadmill: ["speedKmh", "meters"],
  swimming_pool: [],
};

/** What a `recorded` event carries per field: a number, or `null` to clear it. */
export type RecordedValues = Partial<Record<ValueField, number | null>>;

/** One field of a block after replay: the last value recorded, and its origin. */
export type RecordedValue = { value: number; origin: ValueOrigin; at: number };

/**
 * A block's values after replaying every `recorded` event that names it
 * (ADR 0011, §5): per field, the last one written wins; earlier ones stay
 * in the log. `exercise` is the last identity given, or null.
 */
export type BlockRecord = {
  exercise: string | null;
  values: Partial<Record<ValueField, RecordedValue>>;
};

/**
 * A round (ADR 0011, §1), derived from `round_started` markers. It runs to
 * the next marker, or to `stopped`; `endAt` is null only while it is open.
 * Blocks before the first marker belong to no round (a warm-up run before
 * the circuit, as in the founder's second workout).
 */
export type Round = {
  index: number;
  startAt: number;
  endAt: number | null;
};

export type Sample = {
  t: number;
  lat: number;
  lng: number;
  speedMps: number;
  source: "sim" | "gps";
  /**
   * Horizontal accuracy the provider reported for this fix, in metres
   * (68 % confidence radius on Android). Absent when unknown — simulated
   * samples, and real fixes recorded before the accuracy column existed
   * (ADR 0009). Since session 09 it gates what counts for distance and pace
   * (`gateByAccuracy`): a fix only counts once it has moved at least
   * ¼ of its accuracy away from the last one that did. A sample without it
   * always counts.
   */
  accuracyM?: number;
};

/**
 * Minimal structural shape of a GPS fix. Matches the browser's
 * `GeolocationCoordinates` and Expo's `LocationObjectCoords` without importing
 * either, so the engine stays platform-free.
 */
export type GpsCoords = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  accuracy?: number | null;
};

export type SessionStatus = "live" | "stopped";

export type Session = {
  id: string;
  createdAt: number;
  status: SessionStatus;
  events: SessionEvent[];
  samples: Sample[];
};

export type Segment = {
  index: number;
  sport: Sport;
  startAt: number;
  endAt: number | null;
  sampleStart: number;
  sampleEnd: number;
};

/**
 * A stretch of one segment between two "Marca" events — the unit the athlete
 * actually trains in, and what the summary lists. Every segment holds at
 * least one block: with no marks at all, the block and the segment are the
 * same stretch. `endAt` is null only for the one block still open.
 */
export type Block = {
  /** Position in the session, counting every block of every segment. */
  index: number;
  /** The segment this block belongs to; its sport is the segment's sport. */
  segmentIndex: number;
  sport: Sport;
  startAt: number;
  endAt: number | null;
  /**
   * Index of the round this block sits in (ADR 0011), or null before the
   * first `round_started`. Derived, like everything else here: the number
   * of round markers at or before `startAt`, minus one.
   */
  round: number | null;
};

export type SegmentMetrics = {
  durationMs: number;
  distanceM: number;
  avgSpeedMps: number;
};

export type PaceKind = "pace" | "speed" | "none";

/**
 * Which split makes sense for each sport: a running/walking pace (min/km), a
 * cycling speed (km/h), or neither (a transition has no meaningful rate).
 * This is domain logic, not UI copy — display labels for each `Sport` live
 * in `@bricklap/i18n` (keyed by the `Sport` string itself), not here. The
 * engine stays free of any language-specific text.
 */
export const SPORT_PACE_KIND: Record<Sport, PaceKind> = {
  run: "pace",
  bike: "speed",
  walk: "pace",
  transition: "none",
  strength: "none",
  rowing_indoor: "none",
  treadmill: "none",
  swimming_pool: "none",
};

/** Simulated ground speed. Sports without a position feed never move. */
export const SIM_SPEED_MPS: Record<Sport, number> = {
  run: 3.15,
  bike: 7.4,
  walk: 1.45,
  transition: 0.7,
  strength: 0,
  rowing_indoor: 0,
  treadmill: 0,
  swimming_pool: 0,
};
