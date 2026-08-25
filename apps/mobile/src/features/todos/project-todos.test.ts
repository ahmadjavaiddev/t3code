import { describe, expect, it } from "vite-plus/test";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";

import {
  PROJECT_TODO_STATUSES,
  PROJECT_TODO_SECTION_ORDER,
  applyProjectTodoEdit,
  projectTodoSections,
  projectTodosForScope,
  projectTodoStatusLabel,
  projectTodoActionForSwipe,
  projectTodoAgentThreads,
  projectTodoCreateComposerDraftKey,
  projectTodoEditComposerDraftKey,
  sortProjectTodos,
  toggleProjectTodoCompletion,
  type ProjectTodo,
} from "./project-todos";

const todo = (overrides: Partial<ProjectTodo>): ProjectTodo => ({
  id: "todo-1",
  environmentId: EnvironmentId.make("environment-1"),
  projectId: ProjectId.make("project-1"),
  projectTitle: "T3 Code",
  text: "Check the mobile header",
  attachments: [],
  status: "todo",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const thread = (
  overrides: Partial<EnvironmentThreadShell> & Pick<EnvironmentThreadShell, "id" | "title">,
): EnvironmentThreadShell => ({
  environmentId: EnvironmentId.make("environment-1"),
  projectId: ProjectId.make("project-1"),
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  latestTurn: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null,
  settledOverride: null,
  settledAt: null,
  session: null,
  latestUserMessageAt: null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  hasActionableProposedPlan: false,
  ...overrides,
});

describe("project todos", () => {
  it("filters with both the environment and project identity", () => {
    const matching = todo({ id: "matching" });
    const otherEnvironment = todo({
      id: "other-environment",
      environmentId: EnvironmentId.make("environment-2"),
    });
    const otherProject = todo({
      id: "other-project",
      projectId: ProjectId.make("project-2"),
    });

    expect(
      projectTodosForScope([matching, otherEnvironment, otherProject], {
        environmentId: EnvironmentId.make("environment-1"),
        projectId: ProjectId.make("project-1"),
      }).map((entry) => entry.id),
    ).toEqual(["matching"]);
  });

  it("scopes durable composer drafts to the project or edited todo", () => {
    expect(
      projectTodoCreateComposerDraftKey({
        environmentId: EnvironmentId.make("environment-1"),
        projectId: ProjectId.make("project-1"),
      }),
    ).toBe("environment-1:project-todo:new:project-1");
    expect(projectTodoEditComposerDraftKey(todo({ id: "todo-2" }))).toBe(
      "environment-1:project-todo:edit:todo-2",
    );
  });

  it("updates a todo's text and moves it to the selected project", () => {
    const original = todo({ text: "  old note  " });
    const updated = applyProjectTodoEdit(original, {
      text: "  moved note  ",
      project: {
        environmentId: EnvironmentId.make("environment-2"),
        id: ProjectId.make("project-2"),
        title: "Mobile",
        workspaceRoot: "/workspace/mobile",
        repositoryIdentity: null,
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
        defaultModelSelection: null,
        scripts: [],
      },
      status: "in-progress",
      attachments: [],
      updatedAt: 42,
    });

    expect(updated).toMatchObject({
      environmentId: "environment-2",
      projectId: "project-2",
      projectTitle: "Mobile",
      text: "moved note",
      status: "in-progress",
      updatedAt: 42,
    });
    expect(updated?.createdAt).toBe(original.createdAt);
  });

  it("rejects an empty edit", () => {
    expect(
      applyProjectTodoEdit(todo({}), {
        text: "   ",
        project: null,
        status: "completed",
        attachments: [],
        updatedAt: 42,
      }),
    ).toBeNull();
  });

  it("sorts in progress above to do and keeps the latest change first in every section", () => {
    expect(
      sortProjectTodos([
        todo({ id: "completed-old", status: "completed", createdAt: 4, updatedAt: 4 }),
        todo({ id: "completed-latest", status: "completed", createdAt: 1, updatedAt: 12 }),
        todo({ id: "todo-old", createdAt: 5, updatedAt: 5 }),
        todo({ id: "todo-latest", createdAt: 2, updatedAt: 11 }),
        todo({ id: "in-progress-old", status: "in-progress", createdAt: 6, updatedAt: 6 }),
        todo({ id: "in-progress-latest", status: "in-progress", createdAt: 3, updatedAt: 10 }),
      ]).map((entry) => entry.id),
    ).toEqual([
      "in-progress-latest",
      "in-progress-old",
      "todo-latest",
      "todo-old",
      "completed-latest",
      "completed-old",
    ]);
  });

  it("builds sections in the order shown on the mobile screen", () => {
    const sections = projectTodoSections([
      todo({ id: "completed", status: "completed" }),
      todo({ id: "todo" }),
      todo({ id: "in-progress", status: "in-progress" }),
    ]);

    expect(PROJECT_TODO_SECTION_ORDER).toEqual(["in-progress", "todo", "completed"]);
    expect(sections.map((section) => section.title)).toEqual(["In progress", "To do", "Completed"]);
    expect(sections.map((section) => section.todos[0]?.id)).toEqual([
      "in-progress",
      "todo",
      "completed",
    ]);
  });

  it("toggles completion without losing the intermediate status model", () => {
    expect(toggleProjectTodoCompletion(todo({ status: "in-progress" }), 4).status).toBe(
      "completed",
    );
    expect(toggleProjectTodoCompletion(todo({ status: "completed" }), 5).status).toBe("todo");
  });

  it("provides user-facing labels for every status", () => {
    expect(PROJECT_TODO_STATUSES.map(projectTodoStatusLabel)).toEqual([
      "To do",
      "In progress",
      "Completed",
    ]);
  });

  it("maps a right swipe to the agent picker and a left swipe to in progress", () => {
    expect(projectTodoActionForSwipe("right")).toBe("send-to-agent");
    expect(projectTodoActionForSwipe("left")).toBe("in-progress");
  });

  it("defaults to unsettled project threads and can show settled threads", () => {
    const matchingOld = thread({
      id: ThreadId.make("matching-old"),
      title: "Older",
      updatedAt: "2026-08-02T00:00:00.000Z",
    });
    const matchingLatest = thread({
      id: ThreadId.make("matching-latest"),
      title: "Latest",
      latestUserMessageAt: "2026-08-04T00:00:00.000Z",
    });
    const archived = thread({
      id: ThreadId.make("archived"),
      title: "Archived",
      archivedAt: "2026-08-05T00:00:00.000Z",
    });
    const otherEnvironment = thread({
      id: ThreadId.make("other-environment"),
      title: "Other environment",
      environmentId: EnvironmentId.make("environment-2"),
    });
    const otherProject = thread({
      id: ThreadId.make("other-project"),
      title: "Other project",
      projectId: ProjectId.make("project-2"),
    });
    const settled = thread({
      id: ThreadId.make("settled"),
      title: "Settled",
      settledOverride: "settled",
      settledAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    });
    const scope = {
      environmentId: EnvironmentId.make("environment-1"),
      projectId: ProjectId.make("project-1"),
    };

    expect(
      projectTodoAgentThreads(
        [matchingOld, archived, settled, otherEnvironment, matchingLatest, otherProject],
        scope,
        { now: "2026-08-05T00:00:00.000Z" },
      ).map((entry) => entry.id),
    ).toEqual(["matching-latest", "matching-old"]);
    expect(
      projectTodoAgentThreads(
        [matchingOld, archived, settled, otherEnvironment, matchingLatest, otherProject],
        scope,
        { filter: "settled", now: "2026-08-05T00:00:00.000Z" },
      ).map((entry) => entry.id),
    ).toEqual(["settled"]);
  });
});
