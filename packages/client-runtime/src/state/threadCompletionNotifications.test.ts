import type { EnvironmentThreadShell } from "./models.ts";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId, TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  updateThreadCompletionNotificationTracker,
  type ThreadCompletionNotificationTracker,
} from "./threadCompletionNotifications.ts";

function thread(input: {
  readonly id?: string;
  readonly completedAt: string | null;
  readonly state?: "running" | "completed" | "error";
  readonly backgroundLiveness?: "working" | "monitoring" | null;
}): EnvironmentThreadShell {
  return {
    environmentId: EnvironmentId.make("env-1"),
    id: ThreadId.make(input.id ?? "thread-1"),
    projectId: ProjectId.make("project-1"),
    title: `Task ${input.id ?? "thread-1"}`,
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.6" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: {
      turnId: TurnId.make(`turn-${input.id ?? "thread-1"}`),
      state: input.state ?? (input.completedAt === null ? "running" : "completed"),
      requestedAt: "2026-08-24T10:00:00.000Z",
      startedAt: "2026-08-24T10:00:01.000Z",
      completedAt: input.completedAt,
      assistantMessageId: null,
    },
    createdAt: "2026-08-24T10:00:00.000Z",
    updatedAt: input.completedAt ?? "2026-08-24T10:00:01.000Z",
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    session: null,
    latestUserMessageAt: "2026-08-24T10:00:00.000Z",
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    backgroundLiveness: input.backgroundLiveness ?? null,
  };
}

describe("updateThreadCompletionNotificationTracker", () => {
  it("seeds existing completions without replaying them", () => {
    const result = updateThreadCompletionNotificationTracker(null, [
      thread({ completedAt: "2026-08-24T10:05:00.000Z" }),
    ]);

    expect(result.completions).toEqual([]);
  });

  it("reports a running thread once when its completion lands", () => {
    const seeded = updateThreadCompletionNotificationTracker(null, [thread({ completedAt: null })]);
    const completed = updateThreadCompletionNotificationTracker(seeded.tracker, [
      thread({ completedAt: "2026-08-24T10:05:00.000Z" }),
    ]);
    const repeated = updateThreadCompletionNotificationTracker(completed.tracker, [
      thread({ completedAt: "2026-08-24T10:05:00.000Z" }),
    ]);

    expect(completed.completions).toHaveLength(1);
    expect(completed.completions[0]).toMatchObject({
      threadTitle: "Task thread-1",
      completedAt: "2026-08-24T10:05:00.000Z",
    });
    expect(repeated.completions).toEqual([]);
  });

  it("does not alert for a thread first discovered in the completed state", () => {
    const tracker: ThreadCompletionNotificationTracker = {
      completionByThreadKey: new Map([["env-1:thread-1", null]]),
    };
    const result = updateThreadCompletionNotificationTracker(tracker, [
      thread({ id: "thread-2", completedAt: "2026-08-24T10:05:00.000Z" }),
    ]);

    expect(result.completions).toEqual([]);
  });

  it("reports a later turn completion after the thread runs again", () => {
    const seeded = updateThreadCompletionNotificationTracker(null, [
      thread({ completedAt: "2026-08-24T10:05:00.000Z" }),
    ]);
    const runningAgain = updateThreadCompletionNotificationTracker(seeded.tracker, [
      thread({ completedAt: null }),
    ]);
    const completedAgain = updateThreadCompletionNotificationTracker(runningAgain.tracker, [
      thread({ completedAt: "2026-08-24T10:10:00.000Z" }),
    ]);

    expect(completedAgain.completions).toHaveLength(1);
  });

  it("waits for background work to finish before the thread becomes Done", () => {
    const completedAt = "2026-08-24T10:05:00.000Z";
    const seeded = updateThreadCompletionNotificationTracker(null, [thread({ completedAt: null })]);
    const backgroundWork = updateThreadCompletionNotificationTracker(seeded.tracker, [
      thread({ completedAt, backgroundLiveness: "working" }),
    ]);
    const done = updateThreadCompletionNotificationTracker(backgroundWork.tracker, [
      thread({ completedAt }),
    ]);

    expect(backgroundWork.completions).toEqual([]);
    expect(done.completions).toHaveLength(1);
  });

  it("does not report a failed turn as completed", () => {
    const seeded = updateThreadCompletionNotificationTracker(null, [thread({ completedAt: null })]);
    const failed = updateThreadCompletionNotificationTracker(seeded.tracker, [
      thread({ completedAt: "2026-08-24T10:05:00.000Z", state: "error" }),
    ]);

    expect(failed.completions).toEqual([]);
  });
});
