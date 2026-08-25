import { describe, expect, it } from "vite-plus/test";

import { shouldShowThreadCompletionNotification } from "./threadCompletionNotifications";

describe("shouldShowThreadCompletionNotification", () => {
  it("only alerts with permission while the client is in the background", () => {
    expect(
      shouldShowThreadCompletionNotification({
        enabled: true,
        permission: "granted",
        visibilityState: "hidden",
        documentHasFocus: false,
      }),
    ).toBe(true);
    expect(
      shouldShowThreadCompletionNotification({
        enabled: true,
        permission: "granted",
        visibilityState: "visible",
        documentHasFocus: true,
      }),
    ).toBe(false);
    expect(
      shouldShowThreadCompletionNotification({
        enabled: true,
        permission: "denied",
        visibilityState: "hidden",
        documentHasFocus: false,
      }),
    ).toBe(false);
  });
});
