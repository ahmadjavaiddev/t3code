import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

const openDatabaseAsync = vi.hoisted(() => vi.fn());

vi.mock("expo-sqlite", () => ({ openDatabaseAsync }));

import { decodeLegacyCacheRecord, make } from "./mobile-database";

describe("mobile database legacy cache migration", () => {
  it.effect("keeps acquisition failures typed on database operations", () =>
    Effect.scoped(
      Effect.gen(function* () {
        openDatabaseAsync.mockRejectedValueOnce(new Error("SQLite unavailable"));

        const database = yield* make;
        const result = yield* Effect.result(database.loadPreferencesJson);

        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "MobileDatabaseError", operation: "open" },
        });
      }),
    ),
  );

  it("maps legacy thread records to their SQLite identity", () => {
    const payload = JSON.stringify({
      schemaVersion: 2,
      environmentId: "environment-1",
      threadId: "thread-1",
      snapshot: {},
    });

    expect(decodeLegacyCacheRecord("connection-thread-snapshots", payload)).toEqual({
      environmentId: "environment-1",
      kind: "thread",
      cacheKey: "thread-1",
      schemaVersion: 2,
      payload,
    });
  });

  it("preserves the old shell payload for schema decoding after migration", () => {
    const payload = JSON.stringify({
      schemaVersion: 1,
      environmentId: "environment-1",
      snapshotReceivedAt: "2026-07-01T00:00:00.000Z",
      snapshot: {},
    });

    expect(decodeLegacyCacheRecord("shell-snapshots", payload)).toEqual({
      environmentId: "environment-1",
      kind: "shell",
      cacheKey: "snapshot",
      schemaVersion: 1,
      payload,
    });
  });

  it("skips malformed legacy records", () => {
    expect(decodeLegacyCacheRecord("connection-vcs-refs", "{not-json")).toBeNull();
    expect(
      decodeLegacyCacheRecord(
        "connection-vcs-refs",
        JSON.stringify({ schemaVersion: 1, environmentId: "environment-1" }),
      ),
    ).toBeNull();
  });

  it.effect("round-trips project todos through the durable table", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const execAsync = vi.fn(async () => undefined);
        const runAsync = vi.fn(async (..._args: ReadonlyArray<unknown>) => ({
          changes: 1,
          lastInsertRowId: 0,
        }));
        const getFirstAsync = vi.fn(async () => ({ user_version: 2 }));
        const getAllAsync = vi.fn(async () => [
          {
            id: "todo-1",
            environmentId: "environment-1",
            projectId: "project-1",
            projectTitle: "T3 Code",
            text: "Check the mobile header",
            completed: 0,
            createdAt: 1,
            updatedAt: 1,
          },
        ]);
        openDatabaseAsync.mockResolvedValueOnce({
          execAsync,
          runAsync,
          getFirstAsync,
          getAllAsync,
          closeAsync: vi.fn(async () => undefined),
          withExclusiveTransactionAsync: async (
            use: (transaction: { execAsync: typeof execAsync }) => Promise<void>,
          ) => use({ execAsync }),
        });

        const database = yield* make;
        const [stored] = yield* database.loadProjectTodos;
        expect(stored).toEqual({
          id: "todo-1",
          environmentId: "environment-1",
          projectId: "project-1",
          projectTitle: "T3 Code",
          text: "Check the mobile header",
          completed: false,
          createdAt: 1,
          updatedAt: 1,
        });

        yield* database.saveProjectTodo({
          ...stored!,
          environmentId: EnvironmentId.make("environment-1"),
          projectId: ProjectId.make("project-1"),
          completed: true,
          updatedAt: 2,
        });
        yield* database.removeProjectTodo("todo-1");

        expect(runAsync).toHaveBeenCalledTimes(2);
        expect(runAsync.mock.calls[0]?.[0]).toContain("INSERT INTO project_todos");
        expect(runAsync.mock.calls[1]).toEqual([
          "DELETE FROM project_todos WHERE id = ?",
          "todo-1",
        ]);
      }),
    ),
  );
});
