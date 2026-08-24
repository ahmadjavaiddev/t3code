import { describe, expect, it } from "vite-plus/test";

import { markThreadVisitedAt, resolveThreadCompletionVisitedAt } from "./thread-completion";

describe("thread completion visits", () => {
  it("uses the tracking start until a thread-specific visit exists", () => {
    const trackingStartedAt = "2026-01-01T00:00:00.000Z";

    expect(resolveThreadCompletionVisitedAt({}, "environment:thread", trackingStartedAt)).toBe(
      trackingStartedAt,
    );
    expect(
      resolveThreadCompletionVisitedAt(
        { "environment:thread": "2026-01-01T00:00:02.000Z" },
        "environment:thread",
        trackingStartedAt,
      ),
    ).toBe("2026-01-01T00:00:02.000Z");
  });

  it("only advances a thread visit cursor", () => {
    const current = { "environment:thread": "2026-01-01T00:00:02.000Z" };

    expect(markThreadVisitedAt(current, "environment:thread", "invalid")).toBe(current);
    expect(markThreadVisitedAt(current, "environment:thread", "2026-01-01T00:00:01.000Z")).toBe(
      current,
    );
    expect(markThreadVisitedAt(current, "environment:thread", "2026-01-01T00:00:03.000Z")).toEqual({
      "environment:thread": "2026-01-01T00:00:03.000Z",
    });
  });
});
