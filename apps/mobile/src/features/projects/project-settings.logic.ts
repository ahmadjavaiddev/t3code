import {
  MAX_SCRIPT_ID_LENGTH,
  type ProjectScript,
  type ProjectScriptIcon,
  type SidebarProjectGroupingMode,
} from "@t3tools/contracts";

export type GroupingChoice = SidebarProjectGroupingMode | "inherit";

export const PROJECT_GROUPING_LABELS: Record<SidebarProjectGroupingMode, string> = {
  repository: "Group by repository",
  repository_path: "Group by repository path",
  separate: "Keep separate",
};

export const PROJECT_SCRIPT_ICON_LABELS: Record<ProjectScriptIcon, string> = {
  play: "Run",
  test: "Test",
  lint: "Lint",
  configure: "Configure",
  build: "Build",
  debug: "Debug",
};

export interface ProjectScriptDraft {
  readonly id: string | null;
  readonly name: string;
  readonly command: string;
  readonly icon: ProjectScriptIcon;
  readonly runOnWorktreeCreate: boolean;
  readonly previewUrl: string;
  readonly autoOpenPreview: boolean;
}

export function projectScriptDraft(script: ProjectScript | null): ProjectScriptDraft {
  return script
    ? {
        id: script.id,
        name: script.name,
        command: script.command,
        icon: script.icon,
        runOnWorktreeCreate: script.runOnWorktreeCreate,
        previewUrl: script.previewUrl ?? "",
        autoOpenPreview: script.autoOpenPreview ?? false,
      }
    : {
        id: null,
        name: "",
        command: "",
        icon: "play",
        runOnWorktreeCreate: false,
        previewUrl: "",
        autoOpenPreview: false,
      };
}

export function nextProjectScriptId(name: string, existingIds: ReadonlyArray<string>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SCRIPT_ID_LENGTH)
      .replace(/-+$/g, "") || "script";
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_SCRIPT_ID_LENGTH - tail.length)}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`.slice(0, MAX_SCRIPT_ID_LENGTH);
}
