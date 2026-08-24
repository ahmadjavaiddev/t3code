import { describe, expect, it } from "vite-plus/test";

import { environmentDetailsRoute } from "./environmentDetailsNavigation";

describe("environmentDetailsRoute", () => {
  it("opens details directly in the root connection flow", () => {
    expect(environmentDetailsRoute("environment-1")).toEqual({
      name: "ConnectionDetails",
      params: { environmentId: "environment-1" },
    });
  });
});
