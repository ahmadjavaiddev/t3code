import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

import { projectTodosForScope, sortProjectTodos, type ProjectTodo } from "./project-todos";

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
