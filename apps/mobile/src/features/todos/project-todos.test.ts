import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

import {
  applyProjectTodoEdit,
  projectTodosForScope,
  sortProjectTodos,
  type ProjectTodo,
} from "./project-todos";

const todo = (overrides: Partial<ProjectTodo>): ProjectTodo => ({
  id: "todo-1",
  environmentId: EnvironmentId.make("environment-1"),
  projectId: ProjectId.make("project-1"),
  projectTitle: "T3 Code",
  text: "Check the mobile header",
  completed: false,
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
      updatedAt: 42,
    });

    expect(updated).toMatchObject({
      environmentId: "environment-2",
      projectId: "project-2",
      projectTitle: "Mobile",
      text: "moved note",
      updatedAt: 42,
    });
    expect(updated?.completed).toBe(original.completed);
    expect(updated?.createdAt).toBe(original.createdAt);
  });

  it("rejects an empty edit", () => {
    expect(
      applyProjectTodoEdit(todo({}), {
        text: "   ",
        project: null,
        updatedAt: 42,
      }),
    ).toBeNull();
  });

  it("keeps open items first and newest items first within each state", () => {
    expect(
      sortProjectTodos([
        todo({ id: "completed-new", completed: true, createdAt: 4 }),
        todo({ id: "open-old", createdAt: 1 }),
        todo({ id: "completed-old", completed: true, createdAt: 2 }),
        todo({ id: "open-new", createdAt: 3 }),
      ]).map((entry) => entry.id),
    ).toEqual(["open-new", "open-old", "completed-new", "completed-old"]);
  });
});
