export type ThreadFeedPlatform = string;

/**
 * iOS needs a fresh list when the first detail snapshot arrives so UIKit can
 * apply its automatic header inset during attachment. Android has no adjusted
 * header inset here; remounting only throws away measurements and causes the
 * visible empty-to-filled jump.
 */
export function threadFeedListMountKey(
  platform: ThreadFeedPlatform,
  threadKey: string,
  feedIsEmpty: boolean,
): string {
  return platform === "ios" ? `${threadKey}:${feedIsEmpty ? "empty" : "filled"}` : threadKey;
}
