import type { SqlDb } from "./sql";

/**
 * Versioned schema, append-only tables.
 *
 * `schema_version` holds a single row. Migrations run in order inside one
 * transaction each and bump that row; a fresh database starts at 0 and gets
 * every migration. Adding a column or a table later is a new entry in
 * MIGRATIONS, never an edit of an existing one.
 *
 * Two data tables, both insert-only:
 * - `events`: START / CHANGE / STOP / RECOVERED. `discarded` marks a STOP
 *   that the athlete chose to throw away — the row stays, the flag says so.
 * - `samples`: GPS fixes, one row each, at ~1 Hz. Kept apart from `events`
 *   so the hot write path is a handful of numeric columns with no nullable
 *   text, and so the tiny events table is never scanned past thousands of
 *   fixes. Since v2 each row also carries the fix's reported accuracy.
 *
 * Neither table is ever UPDATEd: state is always a replay of these rows (see
 * replay.ts), exactly as the engine derives segments from events. The one
 * DELETE in the adapter is `deleteSession` — the athlete asking for a
 * session to be erased (RGPD, ADR 0006), an explicit operation outside the
 * recording path, never a step of it.
 *
 * A third table, `settings` (v3), holds preferences. It is metadata like
 * `schema_version`, not session data, and it is rewritten in place.
 *
 * Since v4 an event row may carry a JSON `payload`: the block, origin,
 * exercise and values of a `recorded` event (ADR 0011). NULL on every other
 * row.
 */
export type Migration = { version: number; up: (db: SqlDb) => void };

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.execSync(`
        CREATE TABLE events (
          seq        INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT    NOT NULL,
          type       TEXT    NOT NULL,
          at         INTEGER NOT NULL,
          sport      TEXT,
          discarded  INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX events_by_session ON events(session_id, seq);
        CREATE TABLE samples (
          seq        INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT    NOT NULL,
          t          INTEGER NOT NULL,
          lat        REAL    NOT NULL,
          lng        REAL    NOT NULL,
          speed_mps  REAL    NOT NULL,
          source     TEXT    NOT NULL
        );
        CREATE INDEX samples_by_session ON samples(session_id, seq);
      `);
    },
  },
  {
    // v2 (ADR 0009): the horizontal accuracy the provider reported for each
    // fix, in metres, next to the fix itself. NULL for rows written before
    // this column existed and for simulated samples. Additive: rows, seqs
    // and every other column stay exactly as they were.
    version: 2,
    up: (db) => {
      db.execSync("ALTER TABLE samples ADD COLUMN accuracy REAL");
    },
  },
  {
    // v3 (Fase 4): the athlete's own preferences — today only the theme.
    // Metadata, like `schema_version`, and not session data: it is the one
    // table the adapter rewrites in place (INSERT OR REPLACE), which is why
    // it lives apart from `events` and `samples` instead of as a column on
    // either. Nothing here derives from an event, and losing it costs a
    // preference, never a workout.
    version: 3,
    up: (db) => {
      db.execSync(`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    // v4 (ADR 0011, session 26): rounds and recorded values. Two new event
    // types in the same append-only table — `round_started`, which needs no
    // column, and `recorded`, whose fields (block, origin, exercise, values)
    // travel as one JSON `payload`. One nullable column, no new table: the
    // hot path (samples) is untouched, every row written before this
    // migration keeps its seq and reads back exactly as it did, and a
    // `recorded` row is the only kind that ever fills the column. Proven
    // against the founder's own database in the session 26 report.
    version: 4,
    up: (db) => {
      db.execSync("ALTER TABLE events ADD COLUMN payload TEXT");
    },
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export function readSchemaVersion(db: SqlDb): number {
  db.execSync("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const rows = db.getAllSync<{ version: number }>("SELECT version FROM schema_version", []);
  return rows[0]?.version ?? 0;
}

/** Apply every migration above the stored version. Returns the versions crossed. */
export function migrate(db: SqlDb, migrations: readonly Migration[] = MIGRATIONS): { from: number; to: number } {
  const from = readSchemaVersion(db);
  let current = from;
  for (const m of migrations) {
    if (m.version <= current) continue;
    if (m.version !== current + 1) {
      throw new Error(`migration ${m.version} does not follow ${current}`);
    }
    db.withTransactionSync(() => {
      m.up(db);
      if (current === 0) {
        db.runSync("INSERT INTO schema_version (version) VALUES (?)", [m.version]);
      } else {
        // The one UPDATE in the adapter: the version row is metadata, not data.
        db.runSync("UPDATE schema_version SET version = ?", [m.version]);
      }
    });
    current = m.version;
  }
  return { from, to: current };
}
