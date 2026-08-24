import { describe, expect, it } from "vite-plus/test";

import { threadFeedListMountKey } from "./thread-feed-platform";

describe("thread feed platform behavior", () => {
  it("keeps Android's list mounted while its first messages load", () => {
    expect(threadFeedListMountKey("android", "env:thread", true)).toBe("env:thread");
    expect(threadFeedListMountKey("android", "env:thread", false)).toBe("env:thread");
  });

  it("retains the iOS inset remount", () => {
    expect(threadFeedListMountKey("ios", "env:thread", true)).toBe("env:thread:empty");
    expect(threadFeedListMountKey("ios", "env:thread", false)).toBe("env:thread:filled");
  });
});
