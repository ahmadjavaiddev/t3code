import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import type { StoredProjectTodo } from "../../persistence/imperative";

export type ProjectTodo = StoredProjectTodo;

export interface ProjectTodoScope {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}

export function projectTodoScopeKey(
  scope: ProjectTodoScope | { readonly environmentId: EnvironmentId; readonly id: ProjectId },
): string {
  return `${scope.environmentId}:${"projectId" in scope ? scope.projectId : scope.id}`;
}

export function projectTodosForScope(
  todos: ReadonlyArray<ProjectTodo>,
  scope: ProjectTodoScope | { readonly environmentId: EnvironmentId; readonly id: ProjectId },
): ReadonlyArray<ProjectTodo> {
  const projectId = "projectId" in scope ? scope.projectId : scope.id;
  return todos.filter(
    (todo) => todo.environmentId === scope.environmentId && todo.projectId === projectId,
  );
}

export function sortProjectTodos(todos: ReadonlyArray<ProjectTodo>): ReadonlyArray<ProjectTodo> {
  return [...todos].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    return right.createdAt - left.createdAt;
  });
}

export function applyProjectTodoEdit(
  todo: ProjectTodo,
  input: {
    readonly text: string;
    readonly project: EnvironmentProject | null;
    readonly updatedAt: number;
  },
): ProjectTodo | null {
  const text = input.text.trim();
  if (!text) return null;

  return {
    ...todo,
    ...(input.project
      ? {
          environmentId: input.project.environmentId,
          projectId: input.project.id,
          projectTitle: input.project.title,
        }
      : {}),
    text,
    updatedAt: input.updatedAt,
  };
}
