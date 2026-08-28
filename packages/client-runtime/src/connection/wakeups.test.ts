import { describe, expect, it } from "@effect/vitest";

import { isApplicationActiveWakeup, shouldResubscribeAfterWakeup } from "./wakeups.ts";

describe("connection wakeups", () => {
  it("refreshes durable subscriptions after every application resume", () => {
    expect(isApplicationActiveWakeup("application-active-preserved")).toBe(true);
    expect(shouldResubscribeAfterWakeup("application-active")).toBe(true);
    expect(shouldResubscribeAfterWakeup("application-active-preserved")).toBe(false);
    expect(shouldResubscribeAfterWakeup("application-active-probe")).toBe(true);
    expect(shouldResubscribeAfterWakeup("application-active-reconnect")).toBe(true);
    expect(shouldResubscribeAfterWakeup("credentials-changed")).toBe(false);
  });
});
