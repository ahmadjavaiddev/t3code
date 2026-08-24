import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

/**
 * A completion is notable only after this device has visited an earlier
 * completion. Missing visit state therefore keeps historical threads quiet
 * when the feature first lands, matching the web sidebar's unread semantics.
 */
export function hasUnseenThreadCompletion(
  thread: Pick<EnvironmentThreadShell, "latestTurn">,
  lastVisitedAt: string | null | undefined,
): boolean {
  const completedAt = Date.parse(thread.latestTurn?.completedAt ?? "");
  if (Number.isNaN(completedAt) || !lastVisitedAt) return false;

  const visitedAt = Date.parse(lastVisitedAt);
  if (Number.isNaN(visitedAt)) return true;
  return completedAt > visitedAt;
}

/** Monotonic visit update so an older render can never re-arm Done. */
export function markThreadVisitedAt(
  current: Readonly<Record<string, string>>,
  threadKey: string,
  visitedAt: string,
): Readonly<Record<string, string>> {
  const visitedAtMs = Date.parse(visitedAt);
  if (Number.isNaN(visitedAtMs)) return current;

  const previous = current[threadKey];
  const previousMs = previous ? Date.parse(previous) : Number.NaN;
  if (!Number.isNaN(previousMs) && previousMs >= visitedAtMs) return current;

  return { ...current, [threadKey]: visitedAt };
}
