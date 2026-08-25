import type { EnvironmentThreadShell } from "./models.ts";
import { scopedThreadKey } from "../environment/scoped.ts";

export interface ThreadCompletionNotificationItem {
  readonly key: string;
  readonly environmentId: EnvironmentThreadShell["environmentId"];
  readonly threadId: EnvironmentThreadShell["id"];
  readonly projectId: EnvironmentThreadShell["projectId"];
  readonly threadTitle: string;
  readonly completedAt: string;
}

export interface ThreadCompletionNotificationTracker {
  readonly completionByThreadKey: ReadonlyMap<string, string | null>;
}

export interface ThreadCompletionNotificationUpdate {
  readonly tracker: ThreadCompletionNotificationTracker;
  readonly completions: ReadonlyArray<ThreadCompletionNotificationItem>;
}

function doneCompletionAt(thread: EnvironmentThreadShell): string | null {
  if (
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.hasActionableProposedPlan ||
    thread.backgroundLiveness != null ||
    thread.session?.status === "starting" ||
    thread.session?.status === "running" ||
    thread.session?.status === "error" ||
    thread.latestTurn?.state === "running" ||
    thread.latestTurn?.state === "error"
  ) {
    return null;
  }
  return thread.latestTurn?.completedAt ?? null;
}

/**
 * Fold shell updates into completion notifications. A newly discovered shell
 * seeds the tracker without alerting, so hydration, reconnects, and adding an
 * environment cannot replay historical completions as fresh work.
 */
export function updateThreadCompletionNotificationTracker(
  tracker: ThreadCompletionNotificationTracker | null,
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ThreadCompletionNotificationUpdate {
  const previous = tracker?.completionByThreadKey ?? new Map<string, string | null>();
  const next = new Map<string, string | null>();
  const completions: ThreadCompletionNotificationItem[] = [];

  for (const thread of threads) {
    const key = scopedThreadKey({ environmentId: thread.environmentId, threadId: thread.id });
    const completedAt = doneCompletionAt(thread);
    next.set(key, completedAt);

    if (
      tracker === null ||
      !previous.has(key) ||
      completedAt === null ||
      completedAt === previous.get(key)
    ) {
      continue;
    }

    completions.push({
      key,
      environmentId: thread.environmentId,
      threadId: thread.id,
      projectId: thread.projectId,
      threadTitle: thread.title,
      completedAt,
    });
  }

  return {
    tracker: { completionByThreadKey: next },
    completions,
  };
}
