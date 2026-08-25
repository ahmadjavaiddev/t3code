import { describe, expect, it } from "vite-plus/test";

import { nextProjectScriptId, projectScriptDraft } from "./project-settings.logic";

describe("mobile project settings", () => {
  it("creates stable, unique action ids within the contract limit", () => {
    expect(nextProjectScriptId("Run Mobile Tests", [])).toBe("run-mobile-tests");
    expect(nextProjectScriptId("Run Mobile Tests", ["run-mobile-tests"])).toBe(
      "run-mobile-tests-2",
    );
    expect(
      nextProjectScriptId("A very long action name that exceeds the limit", []).length,
    ).toBeLessThanOrEqual(24);
  });

  it("preserves optional action fields while editing", () => {
    expect(
      projectScriptDraft({
        id: "dev",
        name: "Dev server",
        command: "vp run dev",
        icon: "debug",
        runOnWorktreeCreate: true,
        previewUrl: "http://localhost:5173",
        autoOpenPreview: true,
      }),
    ).toEqual({
      id: "dev",
      name: "Dev server",
      command: "vp run dev",
      icon: "debug",
      runOnWorktreeCreate: true,
      previewUrl: "http://localhost:5173",
      autoOpenPreview: true,
    });
  });
});
