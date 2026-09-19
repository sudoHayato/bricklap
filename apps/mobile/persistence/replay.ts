import {
  EXERCISE_KINDS,
  SPORTS,
  VALUE_FIELDS,
  type ExerciseKind,
  type RecordedValues,
  type Sample,
  type Session,
  type SessionEvent,
  type Sport,
  type ValueField,
  type ValueOrigin,
} from "@bricklap/engine";

/** One row of `events`, as SELECTed. */
export type EventRow = {
  seq: number;
  session_id: string;
  type: string;
  at: number;
  sport: string | null;
  discarded: number;
  /** JSON of a `recorded` event's fields (schema v4); NULL on every other row and on rows older than v4. */
  payload: string | null;
};

/** What goes into `events.payload` for a `recorded` event, and comes back out. */
export type RecordedPayload = {
  block: number;
  origin: ValueOrigin;
  exercise?: string;
  /** The kind of exercise the athlete chose (ADR 0012). Absent on every payload written before session 27. */
  kind?: ExerciseKind;
  values: RecordedValues;
};

export function payloadOf(event: SessionEvent): string | null {
  if (event.type !== "recorded") return null;
  const payload: RecordedPayload = {
    block: event.block,
    origin: event.origin,
    ...(event.exercise === undefined ? {} : { exercise: event.exercise }),
    ...(event.kind === undefined ? {} : { kind: event.kind }),
    values: event.values,
  };
  return JSON.stringify(payload);
}

/** Parse and check a `recorded` payload. Loud on any shape the engine would not have written. */
export function parseRecordedPayload(payload: string | null, seq: number): RecordedPayload {
  const bad = (why: string): never => {
    throw new Error(`events.seq=${seq}: recorded payload ${why}`);
  };
  if (payload === null) return bad("is missing");
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return bad("is not JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return bad("is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o["block"] !== "number" || !Number.isInteger(o["block"]) || o["block"] < 0) return bad("has no block index");
  if (o["origin"] !== "declared" && o["origin"] !== "measured") return bad(`has origin ${JSON.stringify(o["origin"])}`);
  if (o["exercise"] !== undefined && typeof o["exercise"] !== "string") return bad("has a non-string exercise");
  if (o["kind"] !== undefined && !(EXERCISE_KINDS as readonly unknown[]).includes(o["kind"])) return bad(`has kind ${JSON.stringify(o["kind"])}`);
  if (typeof o["values"] !== "object" || o["values"] === null || Array.isArray(o["values"])) return bad("has no values");
  const values: RecordedValues = {};
  for (const [field, v] of Object.entries(o["values"] as Record<string, unknown>)) {
    if (!(VALUE_FIELDS as readonly string[]).includes(field)) return bad(`has unknown field ${JSON.stringify(field)}`);
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) return bad(`has a non-numeric ${field}`);
    values[field as ValueField] = v as number | null;
  }
  return {
    block: o["block"],
    origin: o["origin"],
    ...(o["exercise"] === undefined ? {} : { exercise: o["exercise"] as string }),
    ...(o["kind"] === undefined ? {} : { kind: o["kind"] as ExerciseKind }),
    values,
  };
}

/** One row of `samples`, as SELECTed. */
export type SampleRow = {
  session_id: string;
  t: number;
  lat: number;
  lng: number;
  speed_mps: number;
  source: string;
  /** Metres, or NULL when the fix reported none (and for every row older than schema v2). */
  accuracy: number | null;
};

/**
 * A `recovered` written by the background task when Android revived the
 * dead process for a batch of fixes (ADR 0010), as opposed to the athlete
 * reopening the app. Same event for the engine — `eventFromRow` folds it
 * into `recovered` — only the row remembers who restarted; no new column.
 */
export const RECOVERED_HEADLESS_TYPE = "recovered_headless";

export type StoredSession = {
  session: Session;
  /** True when the STOP that closed it carried the discard flag. */
  discarded: boolean;
  /** `seq` of the session's first event; orders sessions the way they were written. */
  firstSeq: number;
};

function asSport(value: string | null, seq: number): Sport {
  if (value !== null && (SPORTS as readonly string[]).includes(value)) return value as Sport;
  throw new Error(`events.seq=${seq}: sport ${JSON.stringify(value)} is not one of ${SPORTS.join(", ")}`);
}

/** Rebuild the engine's event from a row. Loud on anything it does not recognise. */
export function eventFromRow(row: EventRow): SessionEvent {
  switch (row.type) {
    case "started":
      return { type: "started", at: row.at, sport: asSport(row.sport, row.seq) };
    case "sport_changed":
      return { type: "sport_changed", at: row.at, sport: asSport(row.sport, row.seq) };
    case "marked":
      return { type: "marked", at: row.at };
    case "round_started":
      return { type: "round_started", at: row.at };
    case "recorded":
      return { type: "recorded", at: row.at, ...parseRecordedPayload(row.payload, row.seq) };
    case "stopped":
      return { type: "stopped", at: row.at };
    case "recovered":
    case RECOVERED_HEADLESS_TYPE:
      return { type: "recovered", at: row.at };
    default:
      throw new Error(`events.seq=${row.seq}: unknown type ${JSON.stringify(row.type)}`);
  }
}

export function sampleFromRow(row: SampleRow): Sample {
  if (row.source !== "sim" && row.source !== "gps") {
    throw new Error(`samples: unknown source ${JSON.stringify(row.source)}`);
  }
  return {
    t: row.t,
    lat: row.lat,
    lng: row.lng,
    speedMps: row.speed_mps,
    source: row.source,
    // Absent, not null, when unknown: the replayed sample must equal the one
    // the engine built in memory, which never carries a null accuracy.
    ...(row.accuracy === null ? {} : { accuracyM: row.accuracy }),
  };
}

/**
 * Sessions from rows. Pure: the same function serves the app at boot and the
 * recovery test on a database pulled off the phone. Rows must already be in
 * `seq` order (both SELECTs in the repository order by it).
 *
 * Status is derived, never stored: a session with a `stopped` event is
 * stopped, any other is live. `createdAt` is the `at` of its `started` event.
 */
export function replaySessions(events: readonly EventRow[], samples: readonly SampleRow[]): StoredSession[] {
  const byId = new Map<string, StoredSession>();

  for (const row of events) {
    const event = eventFromRow(row);
    let stored = byId.get(row.session_id);
    if (!stored) {
      if (event.type !== "started") {
        throw new Error(`events.seq=${row.seq}: session ${row.session_id} begins with ${event.type}, not started`);
      }
      stored = {
        session: { id: row.session_id, createdAt: event.at, status: "live", events: [], samples: [] },
        discarded: false,
        firstSeq: row.seq,
      };
      byId.set(row.session_id, stored);
    }
    stored.session.events.push(event);
    if (event.type === "stopped") {
      stored.session.status = "stopped";
      if (row.discarded !== 0) stored.discarded = true;
    }
  }

  for (const row of samples) {
    const stored = byId.get(row.session_id);
    // A sample whose session has no events is an orphan; keeping it would
    // invent a session. Skip it rather than fail the whole replay.
    if (!stored) continue;
    stored.session.samples.push(sampleFromRow(row));
  }

  return [...byId.values()].sort((a, b) => a.firstSeq - b.firstSeq);
}
