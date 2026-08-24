import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { toggleExpandedEnvironment } from "./environmentExpansion";

describe("toggleExpandedEnvironment", () => {
  const first = EnvironmentId.make("environment-1");
  const second = EnvironmentId.make("environment-2");

  it("expands a selected environment inline", () => {
    expect(toggleExpandedEnvironment(null, first)).toBe(first);
  });

  it("collapses the selected environment and switches directly between environments", () => {
    expect(toggleExpandedEnvironment(first, first)).toBeNull();
    expect(toggleExpandedEnvironment(first, second)).toBe(second);
  });
});
