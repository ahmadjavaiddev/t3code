import { describe, expect, it } from "vite-plus/test";

import {
  mobileProjectGroupingModePatch,
  mobileProjectGroupingOverridesPatch,
  resolveMobileProjectGroupingSettings,
} from "./project-grouping.logic";

describe("mobile project grouping preferences", () => {
  it("maps the legacy boolean while preferring the new mode", () => {
    expect(resolveMobileProjectGroupingSettings({}).sidebarProjectGroupingMode).toBe("repository");
    expect(
      resolveMobileProjectGroupingSettings({ projectGroupingEnabled: false })
        .sidebarProjectGroupingMode,
    ).toBe("separate");
    expect(
      resolveMobileProjectGroupingSettings({
        projectGroupingEnabled: false,
        projectGroupingMode: "repository_path",
      }).sidebarProjectGroupingMode,
    ).toBe("repository_path");
  });

  it("dual-writes the legacy boolean for rollback compatibility", () => {
    expect(mobileProjectGroupingModePatch("separate")).toEqual({
      projectGroupingMode: "separate",
      projectGroupingEnabled: false,
    });
    expect(mobileProjectGroupingModePatch("repository_path")).toEqual({
      projectGroupingMode: "repository_path",
      projectGroupingEnabled: true,
    });
  });

  it("preserves device-local checkout overrides", () => {
    const overrides = {
      "environment-1:/work/t3code": "separate" as const,
      "environment-2:/work/t3code": "repository_path" as const,
    };

    expect(
      resolveMobileProjectGroupingSettings({ projectGroupingOverrides: overrides })
        .sidebarProjectGroupingOverrides,
    ).toEqual(overrides);
    expect(mobileProjectGroupingOverridesPatch(overrides)).toEqual({
      projectGroupingOverrides: overrides,
    });
  });
});
