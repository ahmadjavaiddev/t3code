import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

import {
  PROJECT_TODO_STATUSES,
  applyProjectTodoEdit,
  projectTodosForScope,
  projectTodoStatusLabel,
  projectTodoStatusForSwipe,
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
  status: "todo",
  createdAt: 1,
  updatedAt: 1,
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
        updatedAt: 42,
      }),
    ).toBeNull();
  });

  it("sorts to do, in progress, and completed items in workflow order", () => {
    expect(
      sortProjectTodos([
        todo({ id: "completed", status: "completed", createdAt: 4 }),
        todo({ id: "todo-old", createdAt: 1 }),
        todo({ id: "in-progress", status: "in-progress", createdAt: 2 }),
        todo({ id: "todo-new", createdAt: 3 }),
      ]).map((entry) => entry.id),
    ).toEqual(["todo-new", "todo-old", "in-progress", "completed"]);
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

  it("maps directional swipes to workflow statuses", () => {
    expect(projectTodoStatusForSwipe("right")).toBe("completed");
    expect(projectTodoStatusForSwipe("left")).toBe("in-progress");
  });
});
