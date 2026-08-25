import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { effectiveSettled } from "@t3tools/client-runtime/state/thread-settled";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import type { DraftComposerImageAttachment } from "../../lib/composerImages";
import type { ProjectTodoStatus, StoredProjectTodo } from "../../persistence/imperative";

export type ProjectTodo = StoredProjectTodo;
export type { ProjectTodoStatus };

export const PROJECT_TODO_STATUSES = ["todo", "in-progress", "completed"] as const;
export const PROJECT_TODO_SECTION_ORDER = ["in-progress", "todo", "completed"] as const;
const PROJECT_TODO_STATUS_ORDER: Readonly<Record<ProjectTodoStatus, number>> = {
  "in-progress": 0,
  todo: 1,
  completed: 2,
};

export function projectTodoStatusLabel(status: ProjectTodoStatus): string {
  if (status === "in-progress") return "In progress";
  if (status === "completed") return "Completed";
  return "To do";
}

export type ProjectTodoSwipeAction = "send-to-agent" | "in-progress";

export function projectTodoActionForSwipe(direction: "left" | "right"): ProjectTodoSwipeAction {
  return direction === "right" ? "send-to-agent" : "in-progress";
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

export function projectTodoCreateComposerDraftKey(scope: ProjectTodoScope): string {
  return `${scope.environmentId}:project-todo:new:${scope.projectId}`;
}

export function projectTodoEditComposerDraftKey(
  todo: Pick<ProjectTodo, "environmentId" | "id">,
): string {
  return `${todo.environmentId}:project-todo:edit:${todo.id}`;
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

function threadActivityTimestamp(thread: EnvironmentThreadShell): number {
  const timestamp = Date.parse(thread.latestUserMessageAt ?? thread.updatedAt ?? thread.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function projectTodoAgentThreads(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  scope: ProjectTodoScope,
  options?: {
    readonly filter?: "unsettled" | "settled";
    readonly now?: string;
    readonly autoSettleAfterDays?: number | null;
  },
): ReadonlyArray<EnvironmentThreadShell> {
  const filter = options?.filter ?? "unsettled";
  const now = options?.now ?? new Date().toISOString();
  const autoSettleAfterDays =
    options?.autoSettleAfterDays === undefined ? 3 : options.autoSettleAfterDays;

  return threads
    .filter(
      (thread) =>
        thread.environmentId === scope.environmentId &&
        thread.projectId === scope.projectId &&
        thread.archivedAt === null &&
        effectiveSettled(thread, { now, autoSettleAfterDays }) === (filter === "settled"),
    )
    .sort(
      (left, right) =>
        threadActivityTimestamp(right) - threadActivityTimestamp(left) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}

export function sortProjectTodos(todos: ReadonlyArray<ProjectTodo>): ReadonlyArray<ProjectTodo> {
  return [...todos].sort((left, right) => {
    if (left.status !== right.status) {
      return PROJECT_TODO_STATUS_ORDER[left.status] - PROJECT_TODO_STATUS_ORDER[right.status];
    }
    return (
      right.updatedAt - left.updatedAt ||
      right.createdAt - left.createdAt ||
      left.id.localeCompare(right.id)
    );
  });
}

export function projectTodoSections(todos: ReadonlyArray<ProjectTodo>) {
  const sorted = sortProjectTodos(todos);
  return PROJECT_TODO_SECTION_ORDER.map((status) => ({
    status,
    title: projectTodoStatusLabel(status),
    todos: sorted.filter((todo) => todo.status === status),
  }));
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
    readonly attachments: ReadonlyArray<DraftComposerImageAttachment>;
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
    attachments: input.attachments,
    status: input.status,
    updatedAt: input.updatedAt,
  };
}
