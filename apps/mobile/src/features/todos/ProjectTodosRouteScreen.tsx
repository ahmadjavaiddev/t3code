import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { KeyboardController, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { EmptyState } from "../../components/EmptyState";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects } from "../../state/entities";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { ProjectTodoComposer } from "./ProjectTodoComposer";
import { useProjectTodos } from "./ProjectTodoProvider";
import { ProjectTodoSwipeable } from "./ProjectTodoSwipeable";
import {
  projectTodoScopeKey,
  projectTodoStatusLabel,
  projectTodosForScope,
  type ProjectTodo,
  type ProjectTodoStatus,
} from "./project-todos";

type ProjectTodosRouteProps = StaticScreenProps<{
  readonly environmentId?: string;
  readonly projectId?: string;
}>;

export function ProjectTodosRouteScreen(props: ProjectTodosRouteProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const todoStore = useProjectTodos();
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const dangerColor = useThemeColor("--color-danger-foreground");
  const primaryForegroundColor = useThemeColor("--color-primary-foreground");
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(() => {
    const environmentId = props.route.params?.environmentId;
    const projectId = props.route.params?.projectId;
    return environmentId && projectId ? `${environmentId}:${projectId}` : null;
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<ProjectTodo | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerProjectKey, setComposerProjectKey] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<ProjectTodoStatus>("todo");
  const [composerSubmitting, setComposerSubmitting] = useState(false);

  const routeEnvironmentId = props.route.params?.environmentId ?? null;
  const routeProjectId = props.route.params?.projectId ?? null;
  const routeScope = useMemo(
    () =>
      routeEnvironmentId && routeProjectId
        ? {
            environmentId: EnvironmentId.make(routeEnvironmentId),
            projectId: ProjectId.make(routeProjectId),
          }
        : null,
    [routeEnvironmentId, routeProjectId],
  );
  const scopedProject = useMemo(
    () =>
      routeScope
        ? (projects.find(
            (project) =>
              project.environmentId === routeScope.environmentId &&
              project.id === routeScope.projectId,
          ) ?? null)
        : null,
    [projects, routeScope],
  );
  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => left.title.localeCompare(right.title)),
    [projects],
  );
  const preferences = AsyncResult.isSuccess(preferencesResult) ? preferencesResult.value : null;

  useEffect(() => {
    if (routeScope) {
      setSelectedProjectKey(projectTodoScopeKey(routeScope));
      return;
    }
    if (preferences === null) return;
    const preferredProjectKey =
      selectedProjectKey ?? preferences.projectTodosLastSelectedProjectKey ?? null;
    if (
      preferredProjectKey === null ||
      !sortedProjects.some((project) => projectTodoScopeKey(project) === preferredProjectKey)
    ) {
      setSelectedProjectKey(sortedProjects[0] ? projectTodoScopeKey(sortedProjects[0]) : null);
    } else if (selectedProjectKey !== preferredProjectKey) {
      setSelectedProjectKey(preferredProjectKey);
    }
  }, [preferences, routeScope, selectedProjectKey, sortedProjects]);

  const selectedProject =
    scopedProject ??
    sortedProjects.find((project) => projectTodoScopeKey(project) === selectedProjectKey) ??
    null;
  const composerProject =
    sortedProjects.find((project) => projectTodoScopeKey(project) === composerProjectKey) ?? null;
  const visibleTodos = useMemo(
    () => (routeScope ? projectTodosForScope(todoStore.todos, routeScope) : todoStore.todos),
    [routeScope, todoStore.todos],
  );
  const todoItems = visibleTodos.filter((todo) => todo.status === "todo");
  const inProgressItems = visibleTodos.filter((todo) => todo.status === "in-progress");
  const completedItems = visibleTodos.filter((todo) => todo.status === "completed");
  const canSubmitComposer =
    composerDraft.trim().length > 0 && (editingTodo !== null || composerProject !== null);

  const closeComposer = () => {
    void KeyboardController.dismiss({ animated: true });
    setComposerOpen(false);
    setEditingTodo(null);
    setComposerSubmitting(false);
  };

  const openCreateComposer = () => {
    if (!selectedProject) return;
    setEditingTodo(null);
    setComposerDraft("");
    setComposerProjectKey(projectTodoScopeKey(selectedProject));
    setComposerStatus("todo");
    setComposerOpen(true);
  };

  const openEditComposer = (todo: ProjectTodo) => {
    setEditingTodo(todo);
    setComposerDraft(todo.text);
    setComposerProjectKey(projectTodoScopeKey(todo));
    setComposerStatus(todo.status);
    setComposerOpen(true);
  };

  const selectComposerProject = (projectKey: string) => {
    setComposerProjectKey(projectKey);
    if (editingTodo || routeScope) return;
    setSelectedProjectKey(projectKey);
    savePreferences({ projectTodosLastSelectedProjectKey: projectKey });
  };

  const submitComposer = async () => {
    if (!canSubmitComposer || composerSubmitting) return;
    setComposerSubmitting(true);
    const saved = editingTodo
      ? await todoStore.updateTodo(editingTodo, composerDraft, composerProject, composerStatus)
      : composerProject
        ? await todoStore.addTodo(composerDraft, composerProject, composerStatus)
        : false;
    if (saved) closeComposer();
    else setComposerSubmitting(false);
  };

  const changeTodoStatus = async (todo: ProjectTodo, status: ProjectTodoStatus) => {
    if (todo.status === status) return;
    await todoStore.updateTodo(todo, todo.text, null, status);
  };

  return (
    <View className="flex-1 bg-sheet">
      <NativeStackScreenOptions
        options={{ headerShown: Platform.OS !== "android", title: "Tasks & notes" }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Tasks & notes" onBack={() => navigation.goBack()} />
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 92 }}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {todoStore.error ? (
          <Pressable
            accessibilityRole="button"
            onPress={todoStore.dismissError}
            className="flex-row items-center gap-3 rounded-2xl border border-border bg-subtle p-4"
          >
            <SymbolView
              name="exclamationmark.triangle"
              size={20}
              tintColor={dangerColor}
              type="monochrome"
            />
            <Text className="flex-1 text-sm text-danger-foreground">
              Tasks could not be saved. Tap to dismiss and try again.
            </Text>
          </Pressable>
        ) : null}

        {todoStore.isLoading ? (
          <View className="items-center gap-3 py-10">
            <ActivityIndicator />
            <Text className="text-sm text-foreground-muted">Loading tasks…</Text>
          </View>
        ) : visibleTodos.length === 0 ? (
          <EmptyState
            variant="plain"
            title={
              routeScope ? `No tasks for ${scopedProject?.title ?? "this project"}` : "No tasks yet"
            }
            detail="Tap the compose button to add a task or note."
          />
        ) : (
          <View className="gap-6">
            {todoItems.length > 0 ? (
              <TodoSection
                title="To do"
                todos={todoItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onEdit={openEditComposer}
                onStatusChange={changeTodoStatus}
                onToggle={todoStore.toggleTodo}
              />
            ) : null}
            {inProgressItems.length > 0 ? (
              <TodoSection
                title="In progress"
                todos={inProgressItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onEdit={openEditComposer}
                onStatusChange={changeTodoStatus}
                onToggle={todoStore.toggleTodo}
              />
            ) : null}
            {completedItems.length > 0 ? (
              <TodoSection
                title="Completed"
                todos={completedItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onEdit={openEditComposer}
                onStatusChange={changeTodoStatus}
                onToggle={todoStore.toggleTodo}
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      {!composerOpen ? (
        <Pressable
          accessibilityLabel="Add task or note"
          accessibilityRole="button"
          disabled={selectedProject === null}
          onPress={openCreateComposer}
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-primary shadow-lg disabled:opacity-45"
          style={{ bottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <SymbolView
            name="square.and.pencil"
            size={22}
            tintColor={primaryForegroundColor}
            type="monochrome"
          />
        </Pressable>
      ) : (
        <>
          <Pressable
            accessibilityLabel="Close task composer"
            accessibilityRole="button"
            className="absolute inset-0"
            onPress={closeComposer}
            style={{ zIndex: 10 }}
          />
          <KeyboardStickyView
            className="absolute inset-x-0 bottom-0"
            offset={{ closed: 0, opened: Math.max(0, Math.max(insets.bottom, 10) - 8) }}
            style={{ zIndex: 20 }}
          >
            <ProjectTodoComposer
              canSubmit={canSubmitComposer}
              isEditing={editingTodo !== null}
              project={composerProject}
              projectFallbackTitle={editingTodo?.projectTitle ?? null}
              projectSelectionLocked={routeScope !== null && editingTodo === null}
              projects={sortedProjects}
              status={composerStatus}
              submitting={composerSubmitting}
              text={composerDraft}
              onChangeProject={selectComposerProject}
              onChangeStatus={setComposerStatus}
              onChangeText={setComposerDraft}
              onClose={closeComposer}
              onSubmit={() => void submitComposer()}
            />
          </KeyboardStickyView>
        </>
      )}
    </View>
  );
}

function TodoStatusBadge(props: { readonly status: ProjectTodoStatus }) {
  return (
    <View
      className={
        props.status === "completed"
          ? "rounded-full bg-emerald-500/10 px-2 py-0.5"
          : props.status === "in-progress"
            ? "rounded-full bg-amber-500/10 px-2 py-0.5"
            : "rounded-full bg-subtle px-2 py-0.5"
      }
    >
      <Text
        className={
          props.status === "completed"
            ? "text-3xs font-t3-bold text-emerald-700 dark:text-emerald-300"
            : props.status === "in-progress"
              ? "text-3xs font-t3-bold text-amber-700 dark:text-amber-300"
              : "text-3xs font-t3-bold text-foreground-muted"
        }
      >
        {projectTodoStatusLabel(props.status)}
      </Text>
    </View>
  );
}

function TodoSection(props: {
  readonly title: string;
  readonly todos: ReadonlyArray<ProjectTodo>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly onToggle: (todo: ProjectTodo) => Promise<void>;
  readonly onDelete: (todo: ProjectTodo) => Promise<void>;
  readonly onEdit: (todo: ProjectTodo) => void;
  readonly onStatusChange: (todo: ProjectTodo, status: ProjectTodoStatus) => Promise<void>;
}) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-t3-bold text-foreground-muted">{props.title}</Text>
      <View className="overflow-hidden rounded-[22px] border border-border bg-card">
        {props.todos.map((todo, index) => (
          <TodoRow
            key={todo.id}
            first={index === 0}
            todo={todo}
            projectTitle={
              props.projects.find(
                (project) =>
                  project.environmentId === todo.environmentId && project.id === todo.projectId,
              )?.title ?? todo.projectTitle
            }
            onDelete={props.onDelete}
            onEdit={props.onEdit}
            onStatusChange={props.onStatusChange}
            onToggle={props.onToggle}
          />
        ))}
      </View>
    </View>
  );
}

function TodoRow(props: {
  readonly todo: ProjectTodo;
  readonly projectTitle: string;
  readonly first: boolean;
  readonly onToggle: (todo: ProjectTodo) => Promise<void>;
  readonly onDelete: (todo: ProjectTodo) => Promise<void>;
  readonly onEdit: (todo: ProjectTodo) => void;
  readonly onStatusChange: (todo: ProjectTodo, status: ProjectTodoStatus) => Promise<void>;
}) {
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");
  const confirmDelete = () => {
    Alert.alert("Delete this task?", props.todo.text, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void props.onDelete(props.todo) },
    ]);
  };

  return (
    <ProjectTodoSwipeable
      status={props.todo.status}
      onStatusChange={(status) => void props.onStatusChange(props.todo, status)}
    >
      <View
        className={`flex-row items-start gap-3 bg-card p-4 ${props.first ? "" : "border-t border-border"}`}
      >
        <Pressable
          accessibilityLabel={
            props.todo.status === "completed" ? "Mark task to do" : "Mark task completed"
          }
          accessibilityRole="checkbox"
          accessibilityState={{ checked: props.todo.status === "completed" }}
          hitSlop={8}
          onPress={() => void props.onToggle(props.todo)}
          className="pt-0.5"
        >
          <SymbolView
            name={
              props.todo.status === "completed"
                ? "checkmark.circle"
                : props.todo.status === "in-progress"
                  ? "clock"
                  : "circle"
            }
            size={22}
            tintColor={props.todo.status === "completed" ? iconColor : mutedColor}
            type="monochrome"
          />
        </Pressable>
        <View className="min-w-0 flex-1 gap-1">
          <Text
            className={
              props.todo.status === "completed"
                ? "text-base leading-normal text-foreground-muted line-through"
                : "text-base leading-normal"
            }
          >
            {props.todo.text}
          </Text>
          <View className="flex-row items-center gap-2">
            <TodoStatusBadge status={props.todo.status} />
            <Text className="min-w-0 flex-1 text-xs text-foreground-muted" numberOfLines={1}>
              {props.projectTitle}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Edit task"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => props.onEdit(props.todo)}
          className="p-1"
        >
          <SymbolView name="pencil" size={18} tintColor={mutedColor} type="monochrome" />
        </Pressable>
        <Pressable
          accessibilityLabel="Delete task"
          accessibilityRole="button"
          hitSlop={8}
          onPress={confirmDelete}
          className="p-1"
        >
          <SymbolView name="trash" size={18} tintColor={mutedColor} type="monochrome" />
        </Pressable>
      </View>
    </ProjectTodoSwipeable>
  );
}
