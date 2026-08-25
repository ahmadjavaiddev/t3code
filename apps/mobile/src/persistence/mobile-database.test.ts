import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

const openDatabaseAsync = vi.hoisted(() => vi.fn());

vi.mock("expo-sqlite", () => ({ openDatabaseAsync }));
vi.mock("expo-file-system", () => ({
  Directory: class Directory {
    readonly exists = false;
  },
  File: class File {
    readonly uri = "";
  },
  Paths: { document: "/documents" },
}));

import {
  decodeLegacyCacheRecord,
  make,
  parseStoredProjectTodoAttachments,
} from "./mobile-database";

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
        const getFirstAsync = vi.fn(async () => ({ user_version: 3 }));
        const getAllAsync = vi.fn(async () => [
          {
            id: "todo-1",
            environmentId: "environment-1",
            projectId: "project-1",
            projectTitle: "T3 Code",
            text: "Check the mobile header",
            attachmentsJson: JSON.stringify([
              {
                id: "image-1",
                type: "image",
                name: "screen.png",
                mimeType: "image/png",
                sizeBytes: 3,
                dataUrl: "data:image/png;base64,YWJj",
              },
            ]),
            statusCode: 2,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "todo-completed",
            environmentId: "environment-1",
            projectId: "project-1",
            projectTitle: "T3 Code",
            text: "Already completed",
            attachmentsJson: "[]",
            statusCode: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "todo-open",
            environmentId: "environment-1",
            projectId: "project-1",
            projectTitle: "T3 Code",
            text: "Still open",
            attachmentsJson: "[]",
            statusCode: 0,
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
        const [stored, legacyCompleted, legacyOpen] = yield* database.loadProjectTodos;
        expect(stored).toEqual({
          id: "todo-1",
          environmentId: "environment-1",
          projectId: "project-1",
          projectTitle: "T3 Code",
          text: "Check the mobile header",
          attachments: [
            {
              id: "image-1",
              type: "image",
              name: "screen.png",
              mimeType: "image/png",
              sizeBytes: 3,
              dataUrl: "data:image/png;base64,YWJj",
              previewUri: "data:image/png;base64,YWJj",
            },
          ],
          status: "in-progress",
          createdAt: 1,
          updatedAt: 1,
        });
        expect(legacyCompleted?.status).toBe("completed");
        expect(legacyOpen?.status).toBe("todo");

        yield* database.saveProjectTodo({
          ...stored!,
          environmentId: EnvironmentId.make("environment-1"),
          projectId: ProjectId.make("project-1"),
          status: "completed",
          updatedAt: 2,
        });
        yield* database.removeProjectTodo("todo-1");

        expect(runAsync).toHaveBeenCalledTimes(2);
        expect(runAsync.mock.calls[0]?.[0]).toContain("INSERT INTO project_todos");
        expect(runAsync.mock.calls[0]?.[6]).toBe(
          JSON.stringify([
            {
              id: "image-1",
              type: "image",
              name: "screen.png",
              mimeType: "image/png",
              sizeBytes: 3,
              dataUrl: "data:image/png;base64,YWJj",
            },
          ]),
        );
        expect(runAsync.mock.calls[0]?.[7]).toBe(1);
        expect(runAsync.mock.calls[1]).toEqual([
          "DELETE FROM project_todos WHERE id = ?",
          "todo-1",
        ]);
      }),
    ),
  );

  it.effect("expands the legacy completion constraint for three task statuses", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const transactionExecAsync = vi.fn(
          async (..._statements: ReadonlyArray<string>) => undefined,
        );
        const execAsync = vi.fn(async () => undefined);
        const getFirstAsync = vi.fn(async () => ({ user_version: 2 }));
        openDatabaseAsync.mockResolvedValueOnce({
          execAsync,
          runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
          getFirstAsync,
          getAllAsync: vi.fn(async () => []),
          closeAsync: vi.fn(async () => undefined),
          withExclusiveTransactionAsync: async (
            use: (transaction: { execAsync: typeof transactionExecAsync }) => Promise<void>,
          ) => use({ execAsync: transactionExecAsync }),
        });

        yield* make;

        expect(transactionExecAsync).toHaveBeenCalledTimes(2);
        expect(transactionExecAsync.mock.calls[1]?.[0]).toContain("CHECK (completed IN (0, 1, 2))");
        expect(transactionExecAsync.mock.calls[1]?.[0]).toContain("attachments_json");
        expect(execAsync).toHaveBeenCalledWith("PRAGMA user_version = 4;");
      }),
    ),
  );

  it.effect("adds image storage to existing version 3 todo tables", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const execAsync = vi.fn(async () => undefined);
        openDatabaseAsync.mockResolvedValueOnce({
          execAsync,
          runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
          getFirstAsync: vi.fn(async () => ({ user_version: 3 })),
          getAllAsync: vi.fn(async () => []),
          closeAsync: vi.fn(async () => undefined),
          withExclusiveTransactionAsync: async (
            use: (transaction: { execAsync: typeof execAsync }) => Promise<void>,
          ) => use({ execAsync }),
        });

        yield* make;

        expect(execAsync).toHaveBeenCalledWith(
          "ALTER TABLE project_todos ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]';",
        );
        expect(execAsync).toHaveBeenCalledWith("PRAGMA user_version = 4;");
      }),
    ),
  );

  it("falls back to no images when stored todo attachment JSON is invalid", () => {
    expect(parseStoredProjectTodoAttachments("not-json")).toEqual([]);
  });
});
