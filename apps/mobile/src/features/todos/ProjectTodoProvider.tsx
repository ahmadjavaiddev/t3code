import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { loadProjectTodos, removeProjectTodo, saveProjectTodo } from "../../persistence/imperative";
import { uuidv4 } from "../../lib/uuid";
import { sortProjectTodos, type ProjectTodo } from "./project-todos";

interface ProjectTodoContextValue {
  readonly todos: ReadonlyArray<ProjectTodo>;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly addTodo: (text: string, project: EnvironmentProject) => Promise<boolean>;
  readonly toggleTodo: (todo: ProjectTodo) => Promise<void>;
  readonly deleteTodo: (todo: ProjectTodo) => Promise<void>;
  readonly dismissError: () => void;
}

const ProjectTodoContext = createContext<ProjectTodoContextValue | null>(null);

export function ProjectTodoProvider(props: PropsWithChildren) {
  const [todos, setTodos] = useState<ReadonlyArray<ProjectTodo>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(false);

  const refresh = useCallback(async (clearError = true) => {
    try {
      const stored = await loadProjectTodos();
      if (mountedRef.current) {
        setTodos(sortProjectTodos(stored));
        if (clearError) setError(null);
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause : new Error("Todo storage is unavailable."));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const persist = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        await operation();
        if (mountedRef.current) setError(null);
        return true;
      } catch (cause) {
        if (mountedRef.current) {
          setError(cause instanceof Error ? cause : new Error("Could not save this todo."));
          await refresh(false);
        }
        return false;
      }
    },
    [refresh],
  );

  const addTodo = useCallback(
    async (text: string, project: EnvironmentProject) => {
      const normalizedText = text.trim();
      if (!normalizedText) return false;
      const now = Date.now();
      const todo: ProjectTodo = {
        id: uuidv4(),
        environmentId: project.environmentId,
        projectId: project.id,
        projectTitle: project.title,
        text: normalizedText,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      setTodos((current) => sortProjectTodos([todo, ...current]));
      return persist(() => saveProjectTodo(todo));
    },
    [persist],
  );

  const toggleTodo = useCallback(
    async (todo: ProjectTodo) => {
      const updated = { ...todo, completed: !todo.completed, updatedAt: Date.now() };
      setTodos((current) =>
        sortProjectTodos(
          current.map((candidate) => (candidate.id === todo.id ? updated : candidate)),
        ),
      );
      await persist(() => saveProjectTodo(updated));
    },
    [persist],
  );

  const deleteTodo = useCallback(
    async (todo: ProjectTodo) => {
      setTodos((current) => current.filter((candidate) => candidate.id !== todo.id));
      await persist(() => removeProjectTodo(todo.id));
    },
    [persist],
  );

  const dismissError = useCallback(() => setError(null), []);
  const value = useMemo<ProjectTodoContextValue>(
    () => ({ todos, isLoading, error, addTodo, toggleTodo, deleteTodo, dismissError }),
    [addTodo, deleteTodo, dismissError, error, isLoading, todos, toggleTodo],
  );

  return <ProjectTodoContext.Provider value={value}>{props.children}</ProjectTodoContext.Provider>;
}

export function useProjectTodos(): ProjectTodoContextValue {
  const context = use(ProjectTodoContext);
  if (!context) {
    throw new Error("useProjectTodos must be used within ProjectTodoProvider");
  }
  return context;
}
