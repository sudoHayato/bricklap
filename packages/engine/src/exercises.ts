import type { ExerciseKind } from "./types";

/**
 * The exercise catalogue (ADR 0012).
 *
 * An exercise is DATA: a stable id, the name the athlete knows it by, a
 * kind, and the other spellings that mean the same thing. The kinds are
 * code (`EXERCISE_KINDS`), because a kind decides which fields a block
 * shows; an exercise is not, because the founder does not write code — a
 * new one enters by being typed in the app, with its kind chosen there, and
 * from then on it is derived from the event log like everything else.
 *
 * The seed is not a gym's list of exercises. It is the exercises of the
 * founder's real workouts (docs/dogfooding/), in his own words, and it
 * grows the same way: from what was actually done.
 */
export type CatalogExercise = {
  id: string;
  /** The name shown, as the athlete writes it. */
  name: string;
  /** Null only for an exercise the athlete typed and never gave a kind to. */
  kind: ExerciseKind | null;
  /** Other spellings of the same exercise. Compared after `foldExerciseName`. */
  aliases: readonly string[];
  /** True for the entries shipped with the app, false for the ones derived from the log. */
  seed: boolean;
};

/**
 * Workout 01 (2026-09-14): 500 m rowing, 10 flexões, 10 bicep com haltere,
 * 500 m on the treadmill, 5 push ups, 10 RDL. Rowing and the treadmill are
 * sports already — their identity is the sport — so the seed holds the
 * other four. "Flexões" and "push ups" stay two entries because the founder
 * listed them as two items of the same round; whether they are one exercise
 * is his to say, and merging them is one alias here, with no row rewritten.
 * RDL is seeded as free weight: the founder files it under "not strength",
 * the ADR 0011 text gives it a load, and between a field that may stay
 * empty and a field that is missing, the empty one loses nothing.
 */
export const SEED_EXERCISES: readonly CatalogExercise[] = [
  { id: "flexoes", name: "Flexões", kind: "bodyweight", aliases: ["flexão", "flexões de braços"], seed: true },
  { id: "push_ups", name: "Push ups", kind: "bodyweight", aliases: ["push up", "pushups", "pushup"], seed: true },
  {
    id: "bicep_haltere",
    name: "Bicep com haltere",
    kind: "free_weight",
    aliases: ["bicep", "biceps", "bicep haltere", "bicep com halteres", "biceps com haltere", "biceps com halteres"],
    seed: true,
  },
  { id: "rdl", name: "RDL", kind: "free_weight", aliases: ["romanian deadlift", "peso morto romeno"], seed: true },
];

/**
 * A name reduced to what it is compared by: trimmed, lowercased, without
 * accents, with hyphens, dots, underscores and slashes read as spaces, and
 * runs of spaces collapsed. "Flexões", "flexoes " and "FLEXÕES" are one
 * name; "push-ups" and "push ups" are one name. Null when nothing is left.
 */
export function foldExerciseName(name: string | null | undefined): string | null {
  const folded = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return folded.length > 0 ? folded : null;
}

/** The catalogue entry a written name means, or null when the catalogue does not know it. */
export function resolveExercise(
  name: string | null | undefined,
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): CatalogExercise | null {
  const folded = foldExerciseName(name);
  if (folded === null) return null;
  for (const entry of catalog) {
    if (foldExerciseName(entry.name) === folded) return entry;
    if (entry.aliases.some((alias) => foldExerciseName(alias) === folded)) return entry;
  }
  return null;
}

/**
 * The identity two blocks are compared by (ADR 0011 §1b, ADR 0012): the
 * catalogue id when the name is known — so "bicep" and "Bicep com haltere"
 * are the same exercise — and the folded name otherwise, so a name the
 * catalogue never heard of still compares with itself across rounds. The
 * two namespaces cannot collide. Null for an empty name.
 */
export function exerciseIdentity(
  name: string | null | undefined,
  catalog: readonly CatalogExercise[] = SEED_EXERCISES,
): string | null {
  const folded = foldExerciseName(name);
  if (folded === null) return null;
  const entry = resolveExercise(name, catalog);
  if (!entry) return `name:${folded}`;
  // A derived entry's id is already the folded name, namespace included.
  return entry.seed ? `ex:${entry.id}` : entry.id;
}

/** One use of an exercise, as a block's record tells it: the name written and the kind chosen, if any. */
export type ExerciseMention = { exercise: string | null; kind: ExerciseKind | null };

/**
 * The catalogue as the athlete's own log extends it, most recently used
 * first and the seed entries never used last. This is how an exercise
 * enters without a programmer: the first block that names "Kettlebell
 * swing" and says "free weight" makes it an entry, and the next session
 * offers it with its kind already set. A kind chosen for a known exercise
 * overrides the catalogue's from then on — the last word is the athlete's.
 * Nothing here is stored: delete the sessions and the entries go with them.
 */
export function catalogFromMentions(
  mentions: readonly ExerciseMention[],
  seed: readonly CatalogExercise[] = SEED_EXERCISES,
): CatalogExercise[] {
  const entries: CatalogExercise[] = seed.map((e) => ({ ...e }));
  const lastUse = new Map<string, number>();
  mentions.forEach((mention, i) => {
    const folded = foldExerciseName(mention.exercise);
    if (folded === null) return;
    let entry = resolveExercise(mention.exercise, entries);
    if (!entry) {
      entry = { id: `name:${folded}`, name: mention.exercise!.trim(), kind: null, aliases: [], seed: false };
      entries.push(entry);
    }
    if (mention.kind !== null) entry.kind = mention.kind;
    lastUse.set(entry.id, i);
  });
  const rank = (e: CatalogExercise) => lastUse.get(e.id) ?? -1;
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => rank(b.entry) - rank(a.entry) || a.i - b.i)
    .map(({ entry }) => entry);
}
