import { describe, expect, it } from "vitest";
import {
  EXERCISE_KINDS,
  SEED_EXERCISES,
  VALUE_FIELDS_BY_KIND,
  applyChange,
  applyMark,
  applyRecord,
  applyRoundStart,
  applyStop,
  blockIdentity,
  blockKind,
  blockRecord,
  blocksFromEvents,
  catalogFromMentions,
  createLiveSession,
  exerciseAcrossRounds,
  exerciseIdentity,
  exerciseMentions,
  fieldsOfBlock,
  fieldsOfKind,
  foldExerciseName,
  identityAcrossRounds,
  resolveExercise,
  type Session,
} from "../src";

/**
 * The exercise taxonomy (ADR 0012). The seed is the founder's real workout
 * 01 — 500 m rowing, 10 flexões, 10 bicep com haltere, 500 m treadmill,
 * 5 push ups, 10 RDL, four rounds — and these tests use it as it was done.
 */

const MIN = 60_000;

describe("foldExerciseName — o nome reduzido ao que se compara", () => {
  it("ignores case, accents, surrounding and repeated spaces, and reads hyphens, dots, underscores and slashes as spaces", () => {
    expect(foldExerciseName("  Flexões ")).toBe("flexoes");
    expect(foldExerciseName("FLEXÕES")).toBe("flexoes");
    expect(foldExerciseName("push-ups")).toBe("push ups");
    expect(foldExerciseName("Push   Ups")).toBe("push ups");
    expect(foldExerciseName("r.d.l")).toBe("r d l");
    expect(foldExerciseName("bicep_haltere/dir")).toBe("bicep haltere dir");
  });

  it("is null when nothing is left", () => {
    expect(foldExerciseName("")).toBeNull();
    expect(foldExerciseName("  - ")).toBeNull();
    expect(foldExerciseName(null)).toBeNull();
    expect(foldExerciseName(undefined)).toBeNull();
  });
});

describe("o catálogo de partida — os exercícios reais do fundador", () => {
  it("holds the four exercises of workout 01 that are not a sport already, each with a kind the fields come from", () => {
    expect(SEED_EXERCISES.map((e) => [e.id, e.name, e.kind])).toEqual([
      ["flexoes", "Flexões", "bodyweight"],
      ["push_ups", "Push ups", "bodyweight"],
      ["bicep_haltere", "Bicep com haltere", "free_weight"],
      ["rdl", "RDL", "free_weight"],
    ]);
    expect(SEED_EXERCISES.every((e) => e.seed)).toBe(true);
    expect([...EXERCISE_KINDS]).toEqual(["free_weight", "bodyweight"]);
    expect(VALUE_FIELDS_BY_KIND).toEqual({ free_weight: ["reps", "loadKg"], bodyweight: ["reps"] });
  });

  it("no two entries answer to the same name: a name resolves to one exercise or to none", () => {
    const names = SEED_EXERCISES.flatMap((e) => [e.name, ...e.aliases].map((n) => foldExerciseName(n)));
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves the founder's own spellings, the ones he typed and the ones in the dogfooding notes", () => {
    expect(resolveExercise("bicep")?.id).toBe("bicep_haltere"); // typed in the session 26 test
    expect(resolveExercise("10 bicep")?.id).toBeUndefined(); // a count is not part of a name
    expect(resolveExercise("Bicep com haltere")?.id).toBe("bicep_haltere");
    expect(resolveExercise("Bíceps")?.id).toBe("bicep_haltere");
    expect(resolveExercise("flexoes")?.id).toBe("flexoes");
    expect(resolveExercise("Push-ups")?.id).toBe("push_ups");
    expect(resolveExercise("pushups")?.id).toBe("push_ups");
    expect(resolveExercise("rdl")?.id).toBe("rdl");
    expect(resolveExercise("Peso morto romeno")?.id).toBe("rdl");
  });

  it("flexões and push ups stay two exercises until the founder says they are one", () => {
    expect(exerciseIdentity("flexões")).toBe("ex:flexoes");
    expect(exerciseIdentity("push ups")).toBe("ex:push_ups");
  });

  it("does not know what it was never told, and an empty name is nothing", () => {
    expect(resolveExercise("kettlebell swing")).toBeNull();
    expect(resolveExercise("")).toBeNull();
    expect(resolveExercise(null)).toBeNull();
  });
});

describe("exerciseIdentity — a identidade por que os blocos se comparam", () => {
  it("is the catalogue id for a known name, in any spelling, and the folded name otherwise", () => {
    expect(exerciseIdentity("bicep")).toBe("ex:bicep_haltere");
    expect(exerciseIdentity("Bicep com haltere")).toBe("ex:bicep_haltere");
    expect(exerciseIdentity("Kettlebell  Swing")).toBe("name:kettlebell swing");
    expect(exerciseIdentity("kettlebell-swing")).toBe("name:kettlebell swing");
    expect(exerciseIdentity("  ")).toBeNull();
    expect(exerciseIdentity(undefined)).toBeNull();
  });

  it("is the same whether or not the athlete's own entries are in the catalogue", () => {
    const catalog = catalogFromMentions([{ exercise: "Kettlebell swing", kind: "free_weight" }]);
    expect(exerciseIdentity("kettlebell swing", catalog)).toBe(exerciseIdentity("kettlebell swing"));
    expect(exerciseIdentity("bicep", catalog)).toBe(exerciseIdentity("bicep"));
  });
});

describe("catalogFromMentions — um exercício novo entra sem programador", () => {
  it("with no history it is the seed, in seed order", () => {
    expect(catalogFromMentions([])).toEqual(SEED_EXERCISES);
    expect(catalogFromMentions([])).not.toBe(SEED_EXERCISES);
  });

  it("a name the catalogue never heard of becomes an entry, with the kind the athlete chose", () => {
    const catalog = catalogFromMentions([{ exercise: " Kettlebell swing ", kind: "free_weight" }]);
    expect(catalog[0]).toEqual({ id: "name:kettlebell swing", name: "Kettlebell swing", kind: "free_weight", aliases: [], seed: false });
    expect(resolveExercise("KETTLEBELL SWING", catalog)?.kind).toBe("free_weight");
    expect(catalog).toHaveLength(SEED_EXERCISES.length + 1);
  });

  it("an entry typed without a kind has none, until a later block gives it one", () => {
    expect(catalogFromMentions([{ exercise: "prancha", kind: null }])[0]!.kind).toBeNull();
    const later = catalogFromMentions([
      { exercise: "prancha", kind: null },
      { exercise: "Prancha", kind: "bodyweight" },
      { exercise: "prancha", kind: null },
    ]);
    expect(later.filter((e) => !e.seed)).toEqual([{ id: "name:prancha", name: "prancha", kind: "bodyweight", aliases: [], seed: false }]);
  });

  it("the athlete's last word on a kind overrides the seed's, without touching the seed", () => {
    const catalog = catalogFromMentions([{ exercise: "rdl", kind: "bodyweight" }]);
    expect(resolveExercise("RDL", catalog)).toMatchObject({ id: "rdl", kind: "bodyweight", seed: true });
    expect(resolveExercise("RDL")!.kind).toBe("free_weight");
  });

  it("orders by most recent use, then the seed entries never used; blank mentions are skipped", () => {
    const catalog = catalogFromMentions([
      { exercise: "rdl", kind: null },
      { exercise: null, kind: "bodyweight" },
      { exercise: "burpees", kind: "bodyweight" },
      { exercise: "  ", kind: null },
      { exercise: "flexões", kind: null },
    ]);
    expect(catalog.map((e) => e.id)).toEqual(["flexoes", "name:burpees", "rdl", "push_ups", "bicep_haltere"]);
  });
});

/** Two rounds of the founder's circuit; round 2 skips the bicep, so positions shift. */
function treino01(): Session {
  let s = createLiveSession("rowing_indoor", 0); // 0  remo            r1
  s = applyChange(s, "strength", 2 * MIN); //        1  flexões         r1
  s = applyMark(s, 3 * MIN); //                      2  bicep           r1
  s = applyChange(s, "treadmill", 4 * MIN); //       3  passadeira      r1
  s = applyChange(s, "strength", 6 * MIN); //        4  push ups        r1
  s = applyMark(s, 7 * MIN); //                      5  RDL             r1
  s = applyChange(s, "rowing_indoor", 8 * MIN); //   6  remo            r2
  s = applyRoundStart(s, 8 * MIN);
  s = applyChange(s, "strength", 10 * MIN); //       7  flexões         r2  (bicep skipped)
  s = applyChange(s, "treadmill", 11 * MIN); //      8  passadeira      r2
  s = applyChange(s, "strength", 13 * MIN); //       9  push ups        r2
  s = applyMark(s, 14 * MIN); //                     10 RDL             r2
  s = applyStop(s, 15 * MIN);
  const name = (block: number, exercise: string, reps: number, loadKg?: number) => {
    s = applyRecord(s, { block, origin: "declared", exercise, values: { reps, ...(loadKg === undefined ? {} : { loadKg }) } }, 16 * MIN);
  };
  name(1, "Flexões", 10);
  name(2, "bicep", 10, 12.5);
  name(4, "push ups", 5);
  name(5, "RDL", 10, 20);
  name(7, "flexoes", 9);
  name(9, "Push-ups", 5);
  name(10, "rdl", 10, 20);
  s = applyRecord(s, { block: 0, origin: "declared", values: { meters: 500 } }, 16 * MIN);
  s = applyRecord(s, { block: 6, origin: "declared", values: { meters: 480 } }, 16 * MIN);
  return s;
}

describe("o tipo decide os campos — fieldsOfKind, blockKind, fieldsOfBlock", () => {
  it("outside a strength block the sport decides and the kind is ignored", () => {
    expect(fieldsOfKind("rowing_indoor", null)).toEqual(["meters", "splitS"]);
    expect(fieldsOfKind("rowing_indoor", "bodyweight")).toEqual(["meters", "splitS"]);
    expect(fieldsOfKind("treadmill", null)).toEqual(["speedKmh", "meters"]);
    expect(fieldsOfKind("run", null)).toEqual([]);
  });

  it("in a strength block: free weight is repetitions and load, body weight is repetitions, unknown is both as before", () => {
    expect(fieldsOfKind("strength", "free_weight")).toEqual(["reps", "loadKg"]);
    expect(fieldsOfKind("strength", "bodyweight")).toEqual(["reps"]);
    expect(fieldsOfKind("strength", null)).toEqual(["reps", "loadKg"]);
  });

  it("a block's kind comes from the catalogue by the name written, and is null where it means nothing", () => {
    const s = treino01();
    const blocks = blocksFromEvents(s.events);
    expect(blocks.map((b) => blockKind(s.events, b))).toEqual([
      null, // rowing: a sport, not a kind
      "bodyweight",
      "free_weight",
      null,
      "bodyweight",
      "free_weight",
      null,
      "bodyweight",
      null,
      "bodyweight",
      "free_weight",
    ]);
    expect(fieldsOfBlock(s.events, blocks[1]!)).toEqual(["reps"]);
    expect(fieldsOfBlock(s.events, blocks[2]!)).toEqual(["reps", "loadKg"]);
    expect(fieldsOfBlock(s.events, blocks[0]!)).toEqual(["meters", "splitS"]);
  });

  it("a strength block nobody described has no kind, and shows both fields", () => {
    const s = createLiveSession("strength", 0);
    const [block] = blocksFromEvents(s.events);
    expect(blockKind(s.events, block!)).toBeNull();
    expect(fieldsOfBlock(s.events, block!)).toEqual(["reps", "loadKg"]);
  });
});

describe("applyRecord com tipo — o que o atleta escolheu fica no evento", () => {
  it("writes the kind the athlete chose, and the block then shows that kind's fields", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "Kettlebell swing", kind: "free_weight", values: { reps: 12, loadKg: 16 } }, MIN);
    expect(s.events.at(-1)).toEqual({
      type: "recorded",
      at: MIN,
      block: 0,
      origin: "declared",
      exercise: "Kettlebell swing",
      kind: "free_weight",
      values: { reps: 12, loadKg: 16 },
    });
    expect(blockRecord(s.events, 0).kind).toBe("free_weight");
    expect(blockKind(s.events, blocksFromEvents(s.events)[0]!)).toBe("free_weight");
  });

  it("a kind alone is worth an event; a kind the engine does not know, or on a block that is not strength, is dropped", () => {
    const s = createLiveSession("strength", 0);
    const next = applyRecord(s, { block: 0, origin: "declared", kind: "bodyweight" }, MIN);
    expect(next.events.at(-1)).toEqual({ type: "recorded", at: MIN, block: 0, origin: "declared", kind: "bodyweight", values: {} });
    expect(applyRecord(s, { block: 0, origin: "declared", kind: "machine" as never }, MIN)).toBe(s);
    const rowing = createLiveSession("rowing_indoor", 0);
    expect(applyRecord(rowing, { block: 0, origin: "declared", kind: "bodyweight" }, MIN)).toBe(rowing);
  });

  it("a load on a body-weight exercise is a typo, not a value — by the catalogue's kind or by the chosen one", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "flexões", values: { reps: 10, loadKg: 20 } }, MIN);
    expect(blockRecord(s.events, 0).values).toEqual({ reps: { value: 10, origin: "declared", at: MIN } });
    let t = createLiveSession("strength", 0);
    t = applyRecord(t, { block: 0, origin: "declared", exercise: "burpees", kind: "bodyweight", values: { loadKg: 20 } }, MIN);
    expect(blockRecord(t.events, 0).values).toEqual({});
    // and the kind already on the block counts for the next write
    expect(applyRecord(t, { block: 0, origin: "declared", values: { loadKg: 20 } }, 2 * MIN)).toBe(t);
  });

  it("a block that turns from bicep into flexões clears its load — null passes for any field of the sport", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "bicep", values: { reps: 10, loadKg: 12.5 } }, MIN);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "flexões", values: { loadKg: null } }, 2 * MIN);
    expect(blockRecord(s.events, 0)).toEqual({
      exercise: "flexões",
      kind: null,
      values: { reps: { value: 10, origin: "declared", at: MIN } },
    });
    // null still cannot clear a field the SPORT does not have
    expect(applyRecord(s, { block: 0, origin: "declared", values: { meters: null } }, 3 * MIN)).toBe(s);
    // and the 12.5 kg are still in the log: nothing was rewritten
    expect(s.events.filter((e) => e.type === "recorded")).toHaveLength(2);
  });

  it("a chosen kind belongs to the exercise it was chosen for: a new name drops it, the same name keeps it", () => {
    let s = createLiveSession("strength", 0);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "RDL", kind: "bodyweight" }, MIN);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "rdl", values: { reps: 10 } }, 2 * MIN); // same exercise, another spelling
    expect(blockRecord(s.events, 0).kind).toBe("bodyweight");
    expect(applyRecord(s, { block: 0, origin: "declared", values: { loadKg: 20 } }, 3 * MIN)).toBe(s);
    s = applyRecord(s, { block: 0, origin: "declared", exercise: "bicep", values: { loadKg: 12.5 } }, 4 * MIN); // another exercise
    expect(blockRecord(s.events, 0)).toMatchObject({ exercise: "bicep", kind: null });
    expect(blockRecord(s.events, 0).values.loadKg?.value).toBe(12.5);
  });

  it("the athlete's own catalogue decides too, when the caller hands it over", () => {
    const catalog = catalogFromMentions([{ exercise: "burpees", kind: "bodyweight" }]);
    const s = createLiveSession("strength", 0);
    const next = applyRecord(s, { block: 0, origin: "declared", exercise: "Burpees", values: { reps: 15, loadKg: 5 } }, MIN, catalog);
    expect(blockRecord(next.events, 0).values).toEqual({ reps: { value: 15, origin: "declared", at: MIN } });
    const [block] = blocksFromEvents(next.events);
    expect(blockKind(next.events, block!, catalog)).toBe("bodyweight");
    expect(blockKind(next.events, block!)).toBeNull();
    expect(fieldsOfBlock(next.events, block!, catalog)).toEqual(["reps"]);
  });
});

describe("a identidade liga a taxonomia às rondas (ADR 0011 §1b)", () => {
  it("a block is its named exercise; unnamed, it is its sport when the sport is an exercise in itself; otherwise nothing", () => {
    const s = treino01();
    const blocks = blocksFromEvents(s.events);
    expect(blocks.slice(0, 6).map((b) => blockIdentity(s.events, b))).toEqual([
      "sport:rowing_indoor",
      "ex:flexoes",
      "ex:bicep_haltere",
      "sport:treadmill",
      "ex:push_ups",
      "ex:rdl",
    ]);
    const bare = applyChange(createLiveSession("strength", 0), "transition", MIN);
    expect(blocksFromEvents(bare.events).map((b) => blockIdentity(bare.events, b))).toEqual([null, null]);
  });

  it("the flexões of round 1 meet the flexões of round 2 by identity — two spellings, two positions, one exercise", () => {
    const s = treino01();
    const flexoes = exerciseAcrossRounds(s, "Flexões");
    expect(flexoes.map((x) => [x.block.index, x.round, x.figures.reps?.value])).toEqual([
      [1, 0, 10],
      [7, 1, 9],
    ]);
    // RDL is the 6th block of round 1 and the 5th of round 2: position would have paired it with the push ups.
    expect(exerciseAcrossRounds(s, "peso morto romeno").map((x) => [x.block.index, x.round])).toEqual([
      [5, 0],
      [10, 1],
    ]);
    // The skipped bicep exists once, and nothing stands in for it in round 2.
    expect(exerciseAcrossRounds(s, "Bicep com haltere").map((x) => x.round)).toEqual([0]);
  });

  it("the rowing of each round lines up too, with nobody having named it", () => {
    const s = treino01();
    expect(identityAcrossRounds(s, "sport:rowing_indoor").map((x) => [x.round, x.figures.meters?.value])).toEqual([
      [0, 500],
      [1, 480],
    ]);
    expect(identityAcrossRounds(s, "ex:nothing")).toEqual([]);
    expect(exerciseAcrossRounds(s, " ")).toEqual([]);
  });

  it("exerciseMentions hands the catalogue one mention per named block, in block order", () => {
    const s = treino01();
    expect(exerciseMentions(s.events).map((m) => m.exercise)).toEqual(["Flexões", "bicep", "push ups", "RDL", "flexoes", "Push-ups", "rdl"]);
    expect(exerciseMentions(s.events).every((m) => m.kind === null)).toBe(true);
    expect(exerciseMentions(createLiveSession("strength", 0).events)).toEqual([]);
  });
});
