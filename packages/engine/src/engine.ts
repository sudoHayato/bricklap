import {
  SIM_SPEED_MPS,
  sportHasGps,
  type Block,
  type Sample,
  type Segment,
  type SegmentMetrics,
  type Session,
  type SessionEvent,
  type Sport,
} from "./types";

const EARTH_M = 6_371_000;

/** Legs faster than this are GPS teleports and are ignored by distanceMeters. */
export const MAX_PLAUSIBLE_SPEED_MPS = 55;

/** Two 'recovered' events closer than this are collapsed into one. */
export const RECOVERED_DEDUPE_MS = 2000;

export function nowMs() {
  return Date.now();
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function destination(
  lat: number,
  lng: number,
  headingRad: number,
  meters: number,
) {
  const d = meters / EARTH_M;
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(headingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(headingRad) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export function segmentsFromEvents(events: SessionEvent[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const event of events) {
    if (event.type === "started") {
      current = {
        index: 0,
        sport: event.sport,
        startAt: event.at,
        endAt: null,
        sampleStart: event.at,
        sampleEnd: event.at,
      };
      segments.push(current);
    } else if (event.type === "sport_changed" && current) {
      current.endAt = event.at;
      current.sampleEnd = event.at;
      current = {
        index: segments.length,
        sport: event.sport,
        startAt: event.at,
        endAt: null,
        sampleStart: event.at,
        sampleEnd: event.at,
      };
      segments.push(current);
    } else if (event.type === "stopped" && current) {
      current.endAt = event.at;
      current.sampleEnd = event.at;
    }
  }

  return segments;
}

/**
 * Blocks derived from the event log (Fase 4). A block runs from the event
 * that opened it — `started`, `sport_changed` or `marked` — to the next of
 * those, or to `stopped`. So a "Marca" splits the segment it lands in
 * without touching the segment list: `segmentsFromEvents` and every metric
 * built on it read exactly as they did before this event existed.
 *
 * Every segment owns at least one block, and the blocks of a segment tile it
 * end to end with no gaps and no overlap — which is what makes the block
 * durations of a segment add up to the segment's own, and their distances to
 * its distance.
 */
export function blocksFromEvents(events: SessionEvent[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let segmentIndex = -1;
  // -1 until the first `round_started`: blocks before it are in no round.
  // Since session 27 a new session writes that marker together with
  // `started`, so its first block is in round 1 from the first instant;
  // sessions recorded before that have none, and their blocks stay at null.
  let round = -1;
  let roundStartAt = Number.NEGATIVE_INFINITY;
  const roundOf = () => (round < 0 ? null : round);

  for (const event of events) {
    if (event.type === "started") {
      segmentIndex = 0;
      current = { index: 0, segmentIndex, sport: event.sport, startAt: event.at, endAt: null, round: roundOf() };
      blocks.push(current);
    } else if (event.type === "sport_changed" && current) {
      current.endAt = event.at;
      segmentIndex++;
      current = { index: blocks.length, segmentIndex, sport: event.sport, startAt: event.at, endAt: null, round: roundOf() };
      blocks.push(current);
    } else if (event.type === "marked" && current) {
      // Same segment and same sport: only the block boundary moves. The
      // annotation is needed: without it the inference is circular, because
      // the object this feeds is assigned back to `current`.
      const sport: Sport = current.sport;
      current.endAt = event.at;
      current = { index: blocks.length, segmentIndex, sport, startAt: event.at, endAt: null, round: roundOf() };
      blocks.push(current);
    } else if (event.type === "round_started" && current) {
      // A round boundary is a block boundary too (ADR 0011) — except when
      // it lands on the block that just opened, typically a CHANGE written
      // at the same instant: then that block is the first of the round and
      // no block of ~0 s is made. The guard is here, in the derivation, so
      // that a marker at exactly the boundary is legal to write.
      //
      // A marker that does not come AFTER the round already open is that
      // same round said twice (the one `started` writes, and a "Nova ronda"
      // at the same instant): it opens nothing. The rule is about order,
      // not duration — no block is ever dropped for being short — and it is
      // what keeps a round from existing with no block in it.
      if (event.at <= roundStartAt) continue;
      roundStartAt = event.at;
      round++;
      if (event.at > current.startAt) {
        const sport: Sport = current.sport;
        current.endAt = event.at;
        current = { index: blocks.length, segmentIndex, sport, startAt: event.at, endAt: null, round };
        blocks.push(current);
      } else {
        current.round = round;
      }
    } else if (event.type === "stopped" && current) {
      current.endAt = event.at;
    }
  }

  return blocks;
}

/** The blocks that belong to one segment, in order. */
export function blocksOfSegment(events: SessionEvent[], segmentIndex: number): Block[] {
  return blocksFromEvents(events).filter((b) => b.segmentIndex === segmentIndex);
}

export function currentSport(events: SessionEvent[]): Sport | null {
  const segs = segmentsFromEvents(events);
  if (segs.length === 0) return null;
  return segs[segs.length - 1]!.sport;
}

/**
 * True when at least one segment is of a sport with GPS — that is, when a
 * total distance is a meaningful thing to show at all. A gym circuit has
 * none, and "0 m" would be noise; a mixed session has one from the moment
 * its first outdoor segment opens, including while a later gym segment is
 * being recorded.
 */
export function hasGpsSegment(events: SessionEvent[]): boolean {
  return segmentsFromEvents(events).some((s) => sportHasGps(s.sport));
}

/** Time of the last 'stopped' event, if any. The last one wins, like in segmentsFromEvents. */
function lastStoppedAt(events: SessionEvent[]): number | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "stopped") return e.at;
  }
  return undefined;
}

/**
 * A session is live only while its status says so AND no 'stopped' event
 * exists. Events are the source of truth, so a stale status never reopens a
 * session that already recorded its stop.
 */
export function isLive(session: Session): boolean {
  return session.status === "live" && lastStoppedAt(session.events) === undefined;
}

export function sessionBounds(session: Session): { start: number; end: number } {
  const start = session.events.find((e) => e.type === "started")?.at ?? session.createdAt;
  const stopped = lastStoppedAt(session.events);
  const lastSample = session.samples.at(-1)?.t;
  const end = stopped ?? lastSample ?? start;
  return { start, end };
}

export function durationMs(session: Session, at = nowMs()) {
  const { start, end } = sessionBounds(session);
  if (isLive(session)) return Math.max(0, at - start);
  return Math.max(0, end - start);
}

/** Plain filter: samples with start <= t <= end. No interpolation. */
export function samplesInRange(samples: Sample[], start: number, end: number) {
  return samples.filter((s) => s.t >= start && s.t <= end);
}

/**
 * Sample synthesised at time `t` by linear interpolation between the last
 * sample before `t` and the first one after it. Null when `t` is outside the
 * recorded span or when a real sample already sits exactly at `t`. Assumes
 * chronological samples.
 */
export function interpolateAt(samples: Sample[], t: number): Sample | null {
  let before: Sample | null = null;
  let after: Sample | null = null;
  for (const s of samples) {
    if (s.t < t) {
      before = s;
    } else if (s.t > t) {
      after = s;
      break;
    } else {
      return null;
    }
  }
  if (!before || !after) return null;
  const f = (t - before.t) / (after.t - before.t);
  return {
    t,
    lat: before.lat + (after.lat - before.lat) * f,
    lng: before.lng + (after.lng - before.lng) * f,
    speedMps: before.speedMps + (after.speedMps - before.speedMps) * f,
    source: before.source,
    // Accuracy only when both neighbours have one; a synthesised sample must
    // not claim a precision nobody measured.
    ...(before.accuracyM !== undefined && after.accuracyM !== undefined
      ? { accuracyM: before.accuracyM + (after.accuracyM - before.accuracyM) * f }
      : {}),
  };
}

/**
 * Samples that belong to the window [start, end]. Both bounds are inclusive,
 * and when no real sample sits exactly on a bound but samples exist on both
 * sides of it, a sample is interpolated there. So a leg that straddles a
 * sport change is split between the two segments instead of being lost, and
 * the segment distances add up to the session distance whatever the sampling
 * cadence.
 */
export function samplesBetween(samples: Sample[], start: number, end: number): Sample[] {
  if (end < start) return [];
  const inside = samplesInRange(samples, start, end);
  const head = inside[0]?.t === start ? null : interpolateAt(samples, start);
  const tail = start === end || inside.at(-1)?.t === end ? null : interpolateAt(samples, end);
  const out = inside.slice();
  if (head) out.unshift(head);
  if (tail) out.push(tail);
  return out;
}

/**
 * How far a fix must have moved from the last fix that counted, as a
 * fraction of its own reported accuracy, before it counts too (ADR 0009,
 * revised in session 09). Decided on data: with the phone lying still for
 * 33 min the plain sum attributed 348 m to GPS jitter (13 % of that session)
 * while the fixes never left an 18 m circle; k = 0.25 removes three quarters
 * of that and costs 0.12 % of the distance actually walked.
 */
export const ACCURACY_GATE_K = 0.25;

/**
 * The fixes that count for distance and pace: the first one always, and
 * then only a fix that sits at least `k × its own accuracy` away from the
 * last fix kept. A fix without a reported accuracy always counts — nothing
 * was measured to gate it on, so simulated and pre-v2 samples behave as
 * before. Pure over the list it is given; callers gate the whole pool of a
 * segment once, so every window of that segment reads the same kept track.
 */
export function gateByAccuracy(samples: Sample[], k = ACCURACY_GATE_K): Sample[] {
  if (k <= 0) return samples;
  const kept: Sample[] = [];
  let last: Sample | null = null;
  for (const s of samples) {
    if (last === null || s.accuracyM === undefined || haversineMeters(last, s) >= k * s.accuracyM) {
      kept.push(s);
      last = s;
    }
  }
  return kept;
}

export function distanceMeters(samples: Sample[]): number {
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const d = haversineMeters(a, b);
    const dt = Math.max(0.001, (b.t - a.t) / 1000);
    if (d / dt > MAX_PLAUSIBLE_SPEED_MPS) continue;
    total += d;
  }
  return total;
}

function segmentEnd(session: Session, segment: Segment, at: number): number {
  return segment.endAt ?? (isLive(session) ? at : sessionBounds(session).end);
}

/**
 * The time span of the run of consecutive GPS segments that `segment` belongs
 * to — from the start of the first one to the end of the last. Interpolation
 * for a GPS segment only ever looks at samples inside this span, so a leg
 * between the last fix before a gym segment and the first fix after it is
 * never split into a boundary sample: a segment without GPS has no samples,
 * and its neighbours must not borrow across it (ADR 0008).
 */
function gpsSpan(session: Session, segment: Segment): { start: number; end: number } {
  const segments = segmentsFromEvents(session.events);
  const i = segments.findIndex((s) => s.startAt === segment.startAt && s.sport === segment.sport);
  // A segment the caller built by hand (not derived from these events): no fence.
  if (i < 0) return { start: -Infinity, end: Infinity };
  let first = i;
  while (first > 0 && sportHasGps(segments[first - 1]!.sport)) first--;
  let last = i;
  while (last < segments.length - 1 && sportHasGps(segments[last + 1]!.sport)) last++;
  // A fence only where a segment without GPS is the neighbour; otherwise the
  // span stays open so a live segment can still interpolate up to `at`.
  return {
    start: first > 0 ? segments[first]!.startAt : -Infinity,
    end: last < segments.length - 1 ? (segments[last]!.endAt ?? Infinity) : Infinity,
  };
}

/**
 * The samples a GPS segment may draw on: the session's, fenced by gpsSpan,
 * then gated by accuracy over the whole span — so a segment's distance, its
 * average pace and every recent-pace window are read off one and the same
 * kept track, and the segment distances still add up to the session's.
 */
function segmentPool(session: Session, segment: Segment): Sample[] {
  const span = gpsSpan(session, segment);
  return gateByAccuracy(samplesInRange(session.samples, span.start, span.end));
}

/**
 * Samples of a segment (see samplesBetween for the boundary rules). A segment
 * of a sport without GPS owns no samples at all, even if some were recorded
 * during it or sit exactly on its bounds.
 */
export function samplesForSegment(session: Session, segment: Segment, at = nowMs()): Sample[] {
  if (!sportHasGps(segment.sport)) return [];
  return samplesBetween(segmentPool(session, segment), segment.startAt, segmentEnd(session, segment, at));
}

/**
 * Length of the trailing window behind "current pace". Chosen on the field
 * data of sessions 04 and 06 (ADR 0009): at 1 Hz a 5–10 s window still
 * jumps by ±1–2 min/km between readings when walking; 30 s brings the
 * 95th-percentile jump down to ±0.3–0.5 min/km walking and ±6 s/km running,
 * while still reacting within a 66 s running interval, which a 60 s window
 * barely registers.
 */
export const RECENT_WINDOW_MS = 30_000;

/**
 * Metrics over the last `windowMs` of a segment, ending at `at` while the
 * segment is open (or at its end once closed): the pace of the moment, as
 * opposed to the segment's average since it started. The window is clipped
 * to the segment — right after a CHANGE it is as short as the segment is,
 * and it never borrows samples from across a segment without GPS. A stop
 * shows up as it should: a window with (almost) no distance, which the
 * formatters already render as "—" below 20 m. A segment without GPS has no
 * recent pace, like it has no pace at all.
 */
export function recentMetrics(
  session: Session,
  segment: Segment,
  at = nowMs(),
  windowMs = RECENT_WINDOW_MS,
): SegmentMetrics {
  const end = segmentEnd(session, segment, at);
  const start = Math.max(segment.startAt, end - windowMs);
  const durationMs = Math.max(0, end - start);
  if (!sportHasGps(segment.sport)) return { durationMs, distanceM: 0, avgSpeedMps: 0 };
  const distanceM = distanceMeters(samplesBetween(segmentPool(session, segment), start, end));
  const avgSpeedMps = durationMs > 0 ? distanceM / (durationMs / 1000) : 0;
  return { durationMs, distanceM, avgSpeedMps };
}

export function metricsFor(
  samples: Sample[],
  startAt: number,
  endAt: number,
): SegmentMetrics {
  const slice = samplesBetween(gateByAccuracy(samples), startAt, endAt);
  const durationMs = Math.max(0, endAt - startAt);
  const distanceM = distanceMeters(slice);
  const avgSpeedMps = durationMs > 0 ? distanceM / (durationMs / 1000) : 0;
  return { durationMs, distanceM, avgSpeedMps };
}

/**
 * Whole-session metrics. Duration spans start to stop (or to `at` while
 * live); distance is the sum of the segments' distances, so only GPS
 * segments contribute and the per-segment rules apply to the total too.
 */
export function sessionMetrics(session: Session, at = nowMs()): SegmentMetrics {
  const { start, end } = sessionBounds(session);
  const durationMs = Math.max(0, (isLive(session) ? at : end) - start);
  const distanceM = segmentsFromEvents(session.events).reduce(
    (sum, segment) => sum + segmentMetrics(session, segment, at).distanceM,
    0,
  );
  const avgSpeedMps = durationMs > 0 ? distanceM / (durationMs / 1000) : 0;
  return { durationMs, distanceM, avgSpeedMps };
}

/** A segment without GPS is time only: distance 0, speed 0. */
export function segmentMetrics(session: Session, segment: Segment, at = nowMs()): SegmentMetrics {
  const end = segmentEnd(session, segment, at);
  const durationMs = Math.max(0, end - segment.startAt);
  if (!sportHasGps(segment.sport)) return { durationMs, distanceM: 0, avgSpeedMps: 0 };
  const distanceM = distanceMeters(samplesForSegment(session, segment, at));
  const avgSpeedMps = durationMs > 0 ? distanceM / (durationMs / 1000) : 0;
  return { durationMs, distanceM, avgSpeedMps };
}

/**
 * Metrics of one block, with the same rules as a segment's: a block of a
 * sport without GPS is time only, and a block of a GPS sport reads its
 * distance off the same accuracy-gated track its segment uses — so the
 * blocks of a segment still add up to the segment.
 */
export function blockMetrics(session: Session, block: Block, at = nowMs()): SegmentMetrics {
  const end = block.endAt ?? (isLive(session) ? at : sessionBounds(session).end);
  const durationMs = Math.max(0, end - block.startAt);
  if (!sportHasGps(block.sport)) return { durationMs, distanceM: 0, avgSpeedMps: 0 };
  const segment = segmentsFromEvents(session.events)[block.segmentIndex];
  // A block built by hand, pointing at no segment of these events: no track
  // to read, so time only rather than a distance borrowed from elsewhere.
  if (!segment) return { durationMs, distanceM: 0, avgSpeedMps: 0 };
  const distanceM = distanceMeters(samplesBetween(segmentPool(session, segment), block.startAt, end));
  const avgSpeedMps = durationMs > 0 ? distanceM / (durationMs / 1000) : 0;
  return { durationMs, distanceM, avgSpeedMps };
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatDistance(meters: number) {
  const rounded = Math.round(meters);
  if (rounded < 1000) return `${rounded} m`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 1 : 2)} km`;
}

export function formatPace(meters: number, durationMs: number) {
  if (meters < 20) return "—";
  const secPerKm = durationMs / 1000 / (meters / 1000);
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return "—";
  // Round the total first so 299.6 s reads 5:00, never 4:60.
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function formatSpeedKmh(mps: number) {
  if (!Number.isFinite(mps) || mps <= 0.2) return "—";
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

export function formatClock(ts: number, locale?: string) {
  return new Date(ts).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(ts: number, locale?: string) {
  return new Date(ts).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * A new live session. Round 1 opens with it (CTO, session 27): the
 * `round_started` at the same instant as `started` tags the first block
 * instead of splitting it, so a session is in round 1 from its first
 * millisecond and "Nova ronda" only ever means round 2 and up. Nobody has
 * to press anything to open the first round — which is what used to leave
 * a block of a few seconds before it.
 */
export function createLiveSession(sport: Sport, at = nowMs(), id = newId()): Session {
  return {
    id,
    createdAt: at,
    status: "live",
    events: [
      { type: "started", at, sport },
      { type: "round_started", at },
    ],
    samples: [],
  };
}

/**
 * The instants at which the rounds of a session really start, strictly
 * increasing: a `round_started` before any `started`, or not after the
 * round already open, is not a round. `blocksFromEvents` applies the same
 * rule inline, so a round and the blocks tagged with it always agree.
 */
export function roundStartsFromEvents(events: SessionEvent[]): number[] {
  const starts: number[] = [];
  let open = false;
  for (const event of events) {
    if (event.type === "started") open = true;
    else if (event.type === "round_started" && open) {
      const last = starts[starts.length - 1];
      if (last === undefined || event.at > last) starts.push(event.at);
    }
  }
  return starts;
}

export function applyChange(session: Session, sport: Sport, at = nowMs()): Session {
  if (!isLive(session)) return session;
  const current = currentSport(session.events);
  // No open segment (no 'started' yet) or same sport: nothing to record.
  if (current === null || current === sport) return session;
  return {
    ...session,
    events: [...session.events, { type: "sport_changed", at, sport }],
  };
}

/**
 * "Marca": close the open block and start the next, in the same segment and
 * the same sport. Ignored when nothing is open — a stopped session, or one
 * with no `started` yet.
 *
 * A mark at or before the start of the open block is ignored too: there is
 * no block to close, and a zero-length block would be a troço of the fiada
 * standing for nothing. It is the real guard against the double fire of a
 * button pressed with a shaking hand, and it costs nothing when the marks
 * are seconds apart, which is every real one.
 */
export function applyMark(session: Session, at = nowMs()): Session {
  if (!isLive(session)) return session;
  const open = blocksFromEvents(session.events).at(-1);
  if (!open || at <= open.startAt) return session;
  return {
    ...session,
    events: [...session.events, { type: "marked", at }],
  };
}

export function applyStop(session: Session, at = nowMs()): Session {
  if (session.status !== "live") return session;
  // A 'stopped' event already recorded: only the stale status needs fixing.
  if (lastStoppedAt(session.events) !== undefined) return { ...session, status: "stopped" };
  return {
    ...session,
    status: "stopped",
    events: [...session.events, { type: "stopped", at }],
  };
}

export function applyRecovered(session: Session, at = nowMs()): Session {
  if (!isLive(session)) return session;
  const last = session.events.at(-1);
  if (last?.type === "recovered" && at - last.at < RECOVERED_DEDUPE_MS) return session;
  return {
    ...session,
    events: [...session.events, { type: "recovered", at }],
  };
}

/**
 * Mark every live session as recovered (app restarted, tab reopened). Stopped
 * sessions are returned untouched. Used by persistence adapters on hydrate.
 */
export function recoverLiveSessions(sessions: Session[], at = nowMs()): Session[] {
  return sessions.map((s) => (isLive(s) ? applyRecovered(s, at) : s));
}

export function appendSample(session: Session, sample: Sample): Session {
  if (!isLive(session)) return session;
  return { ...session, samples: [...session.samples, sample] };
}

export function typicalSpeed(sport: Sport) {
  return SIM_SPEED_MPS[sport];
}
