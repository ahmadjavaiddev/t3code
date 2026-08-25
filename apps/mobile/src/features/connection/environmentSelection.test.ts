import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveSelectedEnvironmentId } from "./environmentSelection";

describe("resolveSelectedEnvironmentId", () => {
  const first = { environmentId: EnvironmentId.make("environment-1") };
  const second = { environmentId: EnvironmentId.make("environment-2") };

  it("selects the first environment by default", () => {
    expect(resolveSelectedEnvironmentId(null, [first, second])).toBe(first.environmentId);
  });

  it("keeps a valid explicit selection", () => {
    expect(resolveSelectedEnvironmentId(second.environmentId, [first, second])).toBe(
      second.environmentId,
    );
  });

  it("falls back to the first remaining environment when the selection disappears", () => {
    expect(resolveSelectedEnvironmentId(second.environmentId, [first])).toBe(first.environmentId);
    expect(resolveSelectedEnvironmentId(first.environmentId, [])).toBeNull();
  });
});
