export type ThreadCompletionNotificationPermission = NotificationPermission | "unsupported";

export function readThreadCompletionNotificationPermission(): ThreadCompletionNotificationPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function requestThreadCompletionNotificationPermission(): Promise<ThreadCompletionNotificationPermission> {
  if (typeof Notification === "undefined") {
    return Promise.resolve("unsupported");
  }
  return Notification.requestPermission();
}

export function shouldShowThreadCompletionNotification(input: {
  readonly enabled: boolean;
  readonly permission: ThreadCompletionNotificationPermission;
  readonly visibilityState: DocumentVisibilityState;
  readonly documentHasFocus: boolean;
}): boolean {
  return (
    input.enabled &&
    input.permission === "granted" &&
    (input.visibilityState !== "visible" || !input.documentHasFocus)
  );
}
