import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_NAME = "t3code-client.db";
const DATABASE_SCHEMA_VERSION = 3;
const LEGACY_CACHE_DIRECTORIES = [
  "connection-shell-snapshots",
  "shell-snapshots",
  "connection-thread-snapshots",
  "connection-server-configs",
  "connection-vcs-refs",
] as const;

export const ClientCacheKind = Schema.Literals(["shell", "thread", "server-config", "vcs-refs"]);
export type ClientCacheKind = typeof ClientCacheKind.Type;

export interface ClientCacheSummaryRow {
  readonly environmentId: EnvironmentId;
  readonly kind: ClientCacheKind;
  readonly recordCount: number;
  readonly payloadBytes: number;
}

export interface StoredPreferencesJson {
  readonly payload: string;
  readonly updatedAt: number;
}

export interface StoredProjectTodo {
  readonly id: string;
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly projectTitle: string;
  readonly text: string;
  readonly status: ProjectTodoStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type ProjectTodoStatus = "todo" | "in-progress" | "completed";

const StoredProjectTodoRows = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    environmentId: Schema.String,
    projectId: Schema.String,
    projectTitle: Schema.String,
    text: Schema.String,
    statusCode: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
);

function projectTodoStatusFromCode(code: number): ProjectTodoStatus {
  if (code === 1) return "completed";
  if (code === 2) return "in-progress";
  return "todo";
}

function projectTodoStatusCode(status: ProjectTodoStatus): number {
  if (status === "completed") return 1;
  if (status === "in-progress") return 2;
  return 0;
}

const ClientCacheSummaryRows = Schema.Array(
  Schema.Struct({
    environmentId: Schema.String,
    kind: ClientCacheKind,
    recordCount: Schema.Number,
    payloadBytes: Schema.Number,
  }),
);

const MobileDatabaseOperation = Schema.Literals([
  "open",
  "migrate",
  "load-cache",
  "save-cache",
  "remove-cache",
  "clear-cache-kind",
  "clear-environment-cache",
  "clear-all-caches",
  "inspect-caches",
  "load-preferences",
  "save-preferences",
  "load-project-todos",
  "save-project-todo",
  "remove-project-todo",
]);

export class MobileDatabaseError extends Schema.TaggedErrorClass<MobileDatabaseError>()(
  "MobileDatabaseError",
  {
    operation: MobileDatabaseOperation,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Mobile database operation failed: ${this.operation}.`;
  }
}

function databaseError(operation: typeof MobileDatabaseOperation.Type) {
  return (cause: unknown) => new MobileDatabaseError({ operation, cause });
}

interface LegacyCacheRecord {
  readonly environmentId: string;
  readonly kind: ClientCacheKind;
  readonly cacheKey: string;
  readonly schemaVersion: number;
  readonly payload: string;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function decodeLegacyCacheRecord(
  directoryName: (typeof LEGACY_CACHE_DIRECTORIES)[number],
  payload: string,
): LegacyCacheRecord | null {
  let parsed: Record<string, unknown> | null;
  try {
    parsed = objectRecord(JSON.parse(payload));
  } catch {
    return null;
  }
  if (
    parsed === null ||
    typeof parsed.environmentId !== "string" ||
    typeof parsed.schemaVersion !== "number"
  ) {
    return null;
  }

  switch (directoryName) {
    case "connection-shell-snapshots":
    case "shell-snapshots":
      return {
        environmentId: parsed.environmentId,
        kind: "shell",
        cacheKey: "snapshot",
        schemaVersion: parsed.schemaVersion,
        payload,
      };
    case "connection-thread-snapshots":
      return typeof parsed.threadId === "string"
        ? {
            environmentId: parsed.environmentId,
            kind: "thread",
            cacheKey: parsed.threadId,
            schemaVersion: parsed.schemaVersion,
            payload,
          }
        : null;
    case "connection-server-configs":
      return {
        environmentId: parsed.environmentId,
        kind: "server-config",
        cacheKey: "config",
        schemaVersion: parsed.schemaVersion,
        payload,
      };
    case "connection-vcs-refs":
      return typeof parsed.cwd === "string"
        ? {
            environmentId: parsed.environmentId,
            kind: "vcs-refs",
            cacheKey: parsed.cwd,
            schemaVersion: parsed.schemaVersion,
            payload,
          }
        : null;
  }
}

async function migrateLegacyFileCaches(database: SQLiteDatabase): Promise<boolean> {
  try {
    const { Directory, File, Paths } = await import("expo-file-system");
    let complete = true;
    const listFiles = (
      directory: InstanceType<typeof Directory>,
    ): Array<InstanceType<typeof File>> =>
      directory.list().flatMap((entry) => (entry instanceof File ? [entry] : listFiles(entry)));

    for (const directoryName of LEGACY_CACHE_DIRECTORIES) {
      try {
        const directory = new Directory(Paths.document, directoryName);
        if (!directory.exists) continue;
        for (const file of listFiles(directory)) {
          const payload = await file.text();
          const record = decodeLegacyCacheRecord(directoryName, payload);
          if (record === null) continue;
          await database.runAsync(
            `INSERT INTO client_cache
              (environment_id, kind, cache_key, schema_version, payload, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (environment_id, kind, cache_key) DO NOTHING`,
            record.environmentId,
            record.kind,
            record.cacheKey,
            record.schemaVersion,
            record.payload,
            Date.now(),
          );
        }
        directory.delete();
      } catch (cause) {
        complete = false;
        console.warn(`[mobile-database] could not migrate legacy cache ${directoryName}`, cause);
      }
    }
    return complete;
  } catch (cause) {
    console.warn("[mobile-database] could not load legacy cache migration", cause);
    return false;
  }
}

export class MobileDatabase extends Context.Service<
  MobileDatabase,
  {
    readonly loadCache: (
      environmentId: EnvironmentId,
      kind: ClientCacheKind,
      cacheKey: string,
    ) => Effect.Effect<Option.Option<string>, MobileDatabaseError>;
    readonly saveCache: (
      environmentId: EnvironmentId,
      kind: ClientCacheKind,
      cacheKey: string,
      schemaVersion: number,
      payload: string,
    ) => Effect.Effect<void, MobileDatabaseError>;
    readonly removeCache: (
      environmentId: EnvironmentId,
      kind: ClientCacheKind,
      cacheKey: string,
    ) => Effect.Effect<void, MobileDatabaseError>;
    readonly clearCacheKind: (
      environmentId: EnvironmentId,
      kind: ClientCacheKind,
    ) => Effect.Effect<void, MobileDatabaseError>;
    readonly clearEnvironmentCache: (
      environmentId: EnvironmentId,
    ) => Effect.Effect<void, MobileDatabaseError>;
    readonly clearAllCaches: Effect.Effect<void, MobileDatabaseError>;
    readonly inspectCaches: Effect.Effect<
      ReadonlyArray<ClientCacheSummaryRow>,
      MobileDatabaseError
    >;
    readonly loadPreferencesJson: Effect.Effect<
      Option.Option<StoredPreferencesJson>,
      MobileDatabaseError
    >;
    readonly savePreferencesJson: (
      payload: string,
      updatedAt: number,
    ) => Effect.Effect<void, MobileDatabaseError>;
    readonly loadProjectTodos: Effect.Effect<ReadonlyArray<StoredProjectTodo>, MobileDatabaseError>;
    readonly saveProjectTodo: (todo: StoredProjectTodo) => Effect.Effect<void, MobileDatabaseError>;
    readonly removeProjectTodo: (id: string) => Effect.Effect<void, MobileDatabaseError>;
  }
>()("@t3tools/mobile/persistence/MobileDatabase") {}

const makeAvailable = Effect.gen(function* () {
  const database = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const SQLite = await import("expo-sqlite");
        return SQLite.openDatabaseAsync(DATABASE_NAME);
      },
      catch: databaseError("open"),
    }),
    (openDatabase) => Effect.promise(() => openDatabase.closeAsync()).pipe(Effect.ignore),
  );

  yield* Effect.tryPromise({
    try: async () => {
      await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const schema = await database.getFirstAsync<{ readonly user_version: number }>(
        "PRAGMA user_version",
      );
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync(`
              CREATE TABLE IF NOT EXISTS client_cache (
                environment_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                cache_key TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (environment_id, kind, cache_key)
              ) WITHOUT ROWID;

              CREATE INDEX IF NOT EXISTS client_cache_environment_updated
                ON client_cache (environment_id, updated_at DESC);

              CREATE TABLE IF NOT EXISTS client_preferences (
                singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
              );

              CREATE TABLE IF NOT EXISTS project_todos (
                id TEXT PRIMARY KEY NOT NULL,
                environment_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                project_title TEXT NOT NULL,
                text TEXT NOT NULL,
                completed INTEGER NOT NULL CHECK (completed IN (0, 1, 2)),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
              );

              CREATE INDEX IF NOT EXISTS project_todos_project_created
                ON project_todos (environment_id, project_id, created_at DESC);
            `);
      });
      if ((schema?.user_version ?? 0) < DATABASE_SCHEMA_VERSION) {
        await database.withExclusiveTransactionAsync(async (transaction) => {
          await transaction.execAsync(`
            ALTER TABLE project_todos RENAME TO project_todos_before_status;
            DROP INDEX IF EXISTS project_todos_project_created;

            CREATE TABLE project_todos (
              id TEXT PRIMARY KEY NOT NULL,
              environment_id TEXT NOT NULL,
              project_id TEXT NOT NULL,
              project_title TEXT NOT NULL,
              text TEXT NOT NULL,
              completed INTEGER NOT NULL CHECK (completed IN (0, 1, 2)),
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );

            INSERT INTO project_todos
              (id, environment_id, project_id, project_title, text, completed, created_at, updated_at)
            SELECT
              id, environment_id, project_id, project_title, text, completed, created_at, updated_at
            FROM project_todos_before_status;

            DROP TABLE project_todos_before_status;

            CREATE INDEX project_todos_project_created
              ON project_todos (environment_id, project_id, created_at DESC);
          `);
        });
        const legacyCachesMigrated =
          (schema?.user_version ?? 0) >= 2 || (await migrateLegacyFileCaches(database));
        if (legacyCachesMigrated) {
          await database.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};`);
        }
      }
    },
    catch: databaseError("migrate"),
  });

  return MobileDatabase.of({
    loadCache: Effect.fn("MobileDatabase.loadCache")((environmentId, kind, cacheKey) =>
      Effect.tryPromise({
        try: () =>
          database.getFirstAsync<{ readonly payload: string }>(
            `SELECT payload
                     FROM client_cache
                     WHERE environment_id = ? AND kind = ? AND cache_key = ?`,
            environmentId,
            kind,
            cacheKey,
          ),
        catch: databaseError("load-cache"),
      }).pipe(Effect.map((row) => Option.fromNullishOr(row?.payload))),
    ),
    saveCache: Effect.fn("MobileDatabase.saveCache")(
      (environmentId, kind, cacheKey, schemaVersion, payload) =>
        Effect.tryPromise({
          try: () =>
            database.runAsync(
              `INSERT INTO client_cache
                      (environment_id, kind, cache_key, schema_version, payload, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT (environment_id, kind, cache_key) DO UPDATE SET
                       schema_version = excluded.schema_version,
                       payload = excluded.payload,
                       updated_at = excluded.updated_at`,
              environmentId,
              kind,
              cacheKey,
              schemaVersion,
              payload,
              Date.now(),
            ),
          catch: databaseError("save-cache"),
        }).pipe(Effect.asVoid),
    ),
    removeCache: Effect.fn("MobileDatabase.removeCache")((environmentId, kind, cacheKey) =>
      Effect.tryPromise({
        try: () =>
          database.runAsync(
            `DELETE FROM client_cache
                     WHERE environment_id = ? AND kind = ? AND cache_key = ?`,
            environmentId,
            kind,
            cacheKey,
          ),
        catch: databaseError("remove-cache"),
      }).pipe(Effect.asVoid),
    ),
    clearCacheKind: Effect.fn("MobileDatabase.clearCacheKind")((environmentId, kind) =>
      Effect.tryPromise({
        try: () =>
          database.runAsync(
            "DELETE FROM client_cache WHERE environment_id = ? AND kind = ?",
            environmentId,
            kind,
          ),
        catch: databaseError("clear-cache-kind"),
      }).pipe(Effect.asVoid),
    ),
    clearEnvironmentCache: Effect.fn("MobileDatabase.clearEnvironmentCache")((environmentId) =>
      Effect.tryPromise({
        try: () =>
          database.runAsync("DELETE FROM client_cache WHERE environment_id = ?", environmentId),
        catch: databaseError("clear-environment-cache"),
      }).pipe(Effect.asVoid),
    ),
    clearAllCaches: Effect.tryPromise({
      try: () => database.runAsync("DELETE FROM client_cache"),
      catch: databaseError("clear-all-caches"),
    }).pipe(Effect.asVoid),
    inspectCaches: Effect.tryPromise({
      try: () =>
        database.getAllAsync<unknown>(`
                SELECT
                  environment_id AS environmentId,
                  kind,
                  COUNT(*) AS recordCount,
                  COALESCE(SUM(LENGTH(CAST(payload AS BLOB))), 0) AS payloadBytes
                FROM client_cache
                GROUP BY environment_id, kind
                ORDER BY environment_id, kind
              `),
      catch: databaseError("inspect-caches"),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(ClientCacheSummaryRows)),
      Effect.mapError(databaseError("inspect-caches")),
      Effect.map(
        (rows): ReadonlyArray<ClientCacheSummaryRow> =>
          rows.map((row) => ({
            environmentId: row.environmentId as EnvironmentId,
            kind: row.kind,
            recordCount: row.recordCount,
            payloadBytes: row.payloadBytes,
          })),
      ),
    ),
    loadPreferencesJson: Effect.tryPromise({
      try: () =>
        database.getFirstAsync<StoredPreferencesJson>(
          `SELECT payload, updated_at AS updatedAt
                 FROM client_preferences
                 WHERE singleton = 1`,
        ),
      catch: databaseError("load-preferences"),
    }).pipe(Effect.map(Option.fromNullishOr)),
    savePreferencesJson: Effect.fn("MobileDatabase.savePreferencesJson")((payload, updatedAt) =>
      Effect.tryPromise({
        try: () =>
          database.runAsync(
            `INSERT INTO client_preferences (singleton, payload, updated_at)
                   VALUES (1, ?, ?)
                   ON CONFLICT (singleton) DO UPDATE SET
                     payload = excluded.payload,
                     updated_at = excluded.updated_at`,
            payload,
            updatedAt,
          ),
        catch: databaseError("save-preferences"),
      }).pipe(Effect.asVoid),
    ),
    loadProjectTodos: Effect.tryPromise({
      try: () =>
        database.getAllAsync<unknown>(`
          SELECT
            id,
            environment_id AS environmentId,
            project_id AS projectId,
            project_title AS projectTitle,
            text,
            completed AS statusCode,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM project_todos
          ORDER BY
            CASE completed WHEN 0 THEN 0 WHEN 2 THEN 1 ELSE 2 END,
            created_at DESC
        `),
      catch: databaseError("load-project-todos"),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(StoredProjectTodoRows)),
      Effect.mapError(databaseError("load-project-todos")),
      Effect.map((todos) =>
        todos.map(({ statusCode, ...todo }) => ({
          ...todo,
          environmentId: todo.environmentId as EnvironmentId,
          projectId: todo.projectId as ProjectId,
          status: projectTodoStatusFromCode(statusCode),
        })),
      ),
    ),
    saveProjectTodo: Effect.fn("MobileDatabase.saveProjectTodo")((todo) =>
      Effect.tryPromise({
        try: () =>
          database.runAsync(
            `INSERT INTO project_todos
              (id, environment_id, project_id, project_title, text, completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               environment_id = excluded.environment_id,
               project_id = excluded.project_id,
               project_title = excluded.project_title,
               text = excluded.text,
               completed = excluded.completed,
               updated_at = excluded.updated_at`,
            todo.id,
            todo.environmentId,
            todo.projectId,
            todo.projectTitle,
            todo.text,
            projectTodoStatusCode(todo.status),
            todo.createdAt,
            todo.updatedAt,
          ),
        catch: databaseError("save-project-todo"),
      }).pipe(Effect.asVoid),
    ),
    removeProjectTodo: Effect.fn("MobileDatabase.removeProjectTodo")((id) =>
      Effect.tryPromise({
        try: () => database.runAsync("DELETE FROM project_todos WHERE id = ?", id),
        catch: databaseError("remove-project-todo"),
      }).pipe(Effect.asVoid),
    ),
  });
});

function makeUnavailable(error: MobileDatabaseError): MobileDatabase["Service"] {
  const fail = Effect.fail(error);
  return MobileDatabase.of({
    loadCache: () => fail,
    saveCache: () => fail,
    removeCache: () => fail,
    clearCacheKind: () => fail,
    clearEnvironmentCache: () => fail,
    clearAllCaches: fail,
    inspectCaches: fail,
    loadPreferencesJson: fail,
    savePreferencesJson: () => fail,
    loadProjectTodos: fail,
    saveProjectTodo: () => fail,
    removeProjectTodo: () => fail,
  });
}

export const make = Effect.result(makeAvailable).pipe(
  Effect.map((result) =>
    result._tag === "Success" ? result.success : makeUnavailable(result.failure),
  ),
);

export const layer = Layer.effect(MobileDatabase, make);
