import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import type { ProjectTodoStatus, StoredProjectTodo } from "../../persistence/imperative";

export type ProjectTodo = StoredProjectTodo;
export type { ProjectTodoStatus };

export const PROJECT_TODO_STATUSES = ["todo", "in-progress", "completed"] as const;

export function projectTodoStatusLabel(status: ProjectTodoStatus): string {
  if (status === "in-progress") return "In progress";
  if (status === "completed") return "Completed";
  return "To do";
}

export function projectTodoStatusForSwipe(direction: "left" | "right"): ProjectTodoStatus {
  return direction === "right" ? "completed" : "in-progress";
}

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
  const statusOrder: Readonly<Record<ProjectTodoStatus, number>> = {
    todo: 0,
    "in-progress": 1,
    completed: 2,
  };
  return [...todos].sort((left, right) => {
    if (left.status !== right.status) {
      return statusOrder[left.status] - statusOrder[right.status];
    }
    return right.createdAt - left.createdAt;
  });
}

export function toggleProjectTodoCompletion(todo: ProjectTodo, updatedAt: number): ProjectTodo {
  return {
    ...todo,
    status: todo.status === "completed" ? "todo" : "completed",
    updatedAt,
  };
}

export function applyProjectTodoEdit(
  todo: ProjectTodo,
  input: {
    readonly text: string;
    readonly project: EnvironmentProject | null;
    readonly status: ProjectTodoStatus;
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
    status: input.status,
    updatedAt: input.updatedAt,
  };
}
