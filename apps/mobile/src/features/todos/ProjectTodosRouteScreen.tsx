import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { EmptyState } from "../../components/EmptyState";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects } from "../../state/entities";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { useThemeColor } from "../../lib/useThemeColor";
import { useProjectTodos } from "./ProjectTodoProvider";
import {
  PROJECT_TODO_STATUSES,
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
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");
  const dangerColor = useThemeColor("--color-danger-foreground");
  const primaryForegroundColor = useThemeColor("--color-primary-foreground");
  const [draft, setDraft] = useState("");
  const [draftStatus, setDraftStatus] = useState<ProjectTodoStatus>("todo");
  const [showProjects, setShowProjects] = useState(false);

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
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(() =>
    routeEnvironmentId && routeProjectId ? `${routeEnvironmentId}:${routeProjectId}` : null,
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
  const visibleTodos = useMemo(
    () => (routeScope ? projectTodosForScope(todoStore.todos, routeScope) : todoStore.todos),
    [routeScope, todoStore.todos],
  );
  const todoItems = visibleTodos.filter((todo) => todo.status === "todo");
  const inProgressItems = visibleTodos.filter((todo) => todo.status === "in-progress");
  const completedItems = visibleTodos.filter((todo) => todo.status === "completed");

  const submit = async () => {
    if (!selectedProject || !draft.trim()) return;
    if (await todoStore.addTodo(draft, selectedProject, draftStatus)) {
      setDraft("");
      setDraftStatus("todo");
    }
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
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) }}
        contentContainerClassName="gap-6 px-5 pt-4"
      >
        <View className="gap-3 rounded-[22px] border border-border bg-card p-4">
          <TextInput
            accessibilityLabel="New task or note"
            blurOnSubmit={false}
            editable={selectedProject !== null}
            onChangeText={setDraft}
            onSubmitEditing={() => void submit()}
            placeholder={
              selectedProject
                ? "Add a small task or note…"
                : routeScope
                  ? "Loading project…"
                  : "Choose a project first"
            }
            returnKeyType="done"
            value={draft}
          />

          <TodoStatusPicker
            accessibilityLabel="New task status"
            value={draftStatus}
            onChange={setDraftStatus}
          />

          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Choose project"
              accessibilityRole="button"
              disabled={routeScope !== null || sortedProjects.length === 0}
              onPress={() => setShowProjects((current) => !current)}
              className="min-w-0 flex-1 flex-row items-center gap-2 rounded-full bg-subtle px-3.5 py-3 disabled:opacity-70"
            >
              <SymbolView name="folder" size={17} tintColor={iconColor} type="monochrome" />
              <Text className="min-w-0 flex-1 text-sm font-t3-medium" numberOfLines={1}>
                {selectedProject?.title ?? (routeScope ? "Project tasks" : "No projects available")}
              </Text>
              {routeScope ? null : (
                <SymbolView
                  name="chevron.down"
                  size={15}
                  tintColor={mutedColor}
                  type="monochrome"
                />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Add task or note"
              accessibilityRole="button"
              disabled={!selectedProject || !draft.trim()}
              onPress={() => void submit()}
              className="size-12 items-center justify-center rounded-full bg-primary disabled:opacity-40"
            >
              <SymbolView
                name="plus"
                size={20}
                tintColor={primaryForegroundColor}
                type="monochrome"
              />
            </Pressable>
          </View>

          {showProjects && !routeScope ? (
            <View className="overflow-hidden rounded-2xl border border-border">
              {sortedProjects.map((project, index) => {
                const isSelected = projectTodoScopeKey(project) === selectedProjectKey;
                return (
                  <ProjectOption
                    key={projectTodoScopeKey(project)}
                    first={index === 0}
                    isSelected={isSelected}
                    project={project}
                    onPress={() => {
                      setSelectedProjectKey(projectTodoScopeKey(project));
                      savePreferences({
                        projectTodosLastSelectedProjectKey: projectTodoScopeKey(project),
                      });
                      setShowProjects(false);
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          <Text className="px-1 text-xs leading-normal text-foreground-muted">
            Saved on this device and grouped by project.
          </Text>
        </View>

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
            detail="Add a quick task or note above, then mark it complete when it is done."
          />
        ) : (
          <View className="gap-6">
            {todoItems.length > 0 ? (
              <TodoSection
                title="To do"
                todos={todoItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onToggle={todoStore.toggleTodo}
                onUpdate={todoStore.updateTodo}
              />
            ) : null}
            {inProgressItems.length > 0 ? (
              <TodoSection
                title="In progress"
                todos={inProgressItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onToggle={todoStore.toggleTodo}
                onUpdate={todoStore.updateTodo}
              />
            ) : null}
            {completedItems.length > 0 ? (
              <TodoSection
                title="Completed"
                todos={completedItems}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onToggle={todoStore.toggleTodo}
                onUpdate={todoStore.updateTodo}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TodoStatusPicker(props: {
  readonly accessibilityLabel: string;
  readonly value: ProjectTodoStatus;
  readonly onChange: (status: ProjectTodoStatus) => void;
}) {
  return (
    <View accessibilityLabel={props.accessibilityLabel} className="flex-row gap-2">
      {PROJECT_TODO_STATUSES.map((status) => {
        const selected = props.value === status;
        return (
          <Pressable
            key={status}
            accessibilityLabel={projectTodoStatusLabel(status)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => props.onChange(status)}
            className={
              selected
                ? "min-h-[38px] flex-1 items-center justify-center rounded-xl bg-primary px-1 py-2"
                : "min-h-[38px] flex-1 items-center justify-center rounded-xl bg-subtle px-1 py-2"
            }
          >
            <Text
              className={
                selected
                  ? "text-2xs font-t3-bold text-primary-foreground"
                  : "text-2xs font-t3-bold text-foreground-muted"
              }
              numberOfLines={1}
            >
              {projectTodoStatusLabel(status)}
            </Text>
          </Pressable>
        );
      })}
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

function ProjectOption(props: {
  readonly project: EnvironmentProject;
  readonly isSelected: boolean;
  readonly first: boolean;
  readonly onPress: () => void;
}) {
  const iconColor = useThemeColor("--color-icon");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      className={`flex-row items-center gap-3 bg-sheet-solid p-3.5 ${props.first ? "" : "border-t border-border"}`}
    >
      <SymbolView name="folder" size={18} tintColor={iconColor} type="monochrome" />
      <View className="min-w-0 flex-1">
        <Text className="font-t3-medium" numberOfLines={1}>
          {props.project.title}
        </Text>
        <Text className="text-xs text-foreground-muted" numberOfLines={1}>
          {props.project.workspaceRoot}
        </Text>
      </View>
      {props.isSelected ? (
        <SymbolView name="checkmark" size={17} tintColor={iconColor} type="monochrome" />
      ) : null}
    </Pressable>
  );
}

function TodoSection(props: {
  readonly title: string;
  readonly todos: ReadonlyArray<ProjectTodo>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly onToggle: (todo: ProjectTodo) => Promise<void>;
  readonly onDelete: (todo: ProjectTodo) => Promise<void>;
  readonly onUpdate: (
    todo: ProjectTodo,
    text: string,
    project: EnvironmentProject | null,
    status: ProjectTodoStatus,
  ) => Promise<boolean>;
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
            projects={props.projects}
            projectTitle={
              props.projects.find(
                (project) =>
                  project.environmentId === todo.environmentId && project.id === todo.projectId,
              )?.title ?? todo.projectTitle
            }
            onDelete={props.onDelete}
            onToggle={props.onToggle}
            onUpdate={props.onUpdate}
          />
        ))}
      </View>
    </View>
  );
}

function TodoRow(props: {
  readonly todo: ProjectTodo;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly projectTitle: string;
  readonly first: boolean;
  readonly onToggle: (todo: ProjectTodo) => Promise<void>;
  readonly onDelete: (todo: ProjectTodo) => Promise<void>;
  readonly onUpdate: (
    todo: ProjectTodo,
    text: string,
    project: EnvironmentProject | null,
    status: ProjectTodoStatus,
  ) => Promise<boolean>;
}) {
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(props.todo.text);
  const [editProjectKey, setEditProjectKey] = useState(() => projectTodoScopeKey(props.todo));
  const [editStatus, setEditStatus] = useState<ProjectTodoStatus>(props.todo.status);
  const [showEditProjects, setShowEditProjects] = useState(false);
  const editProject =
    props.projects.find((project) => projectTodoScopeKey(project) === editProjectKey) ?? null;
  const saveEdit = async () => {
    if (await props.onUpdate(props.todo, editDraft, editProject, editStatus)) {
      setShowEditProjects(false);
      setIsEditing(false);
    }
  };
  const confirmDelete = () => {
    Alert.alert("Delete this task?", props.todo.text, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void props.onDelete(props.todo) },
    ]);
  };

  return (
    <View
      className={`flex-row items-start gap-3 p-4 ${props.first ? "" : "border-t border-border"}`}
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
        {isEditing ? (
          <TextInput
            accessibilityLabel="Edit task or note"
            autoFocus
            blurOnSubmit={false}
            onChangeText={setEditDraft}
            onSubmitEditing={() => void saveEdit()}
            returnKeyType="done"
            value={editDraft}
          />
        ) : (
          <Text
            className={
              props.todo.status === "completed"
                ? "text-base leading-normal text-foreground-muted line-through"
                : "text-base leading-normal"
            }
          >
            {props.todo.text}
          </Text>
        )}
        {isEditing ? (
          <>
            <Pressable
              accessibilityLabel={`Change project from ${editProject?.title ?? props.projectTitle}`}
              accessibilityRole="button"
              disabled={props.projects.length === 0}
              onPress={() => setShowEditProjects((current) => !current)}
              className="mt-1 flex-row items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 disabled:opacity-60"
            >
              <SymbolView name="folder" size={15} tintColor={iconColor} type="monochrome" />
              <Text className="min-w-0 flex-1 text-xs font-t3-medium" numberOfLines={1}>
                {editProject?.title ?? props.projectTitle}
              </Text>
              <SymbolView
                name="chevron.down"
                size={13}
                tintColor={mutedColor}
                type="monochrome"
                style={{ transform: [{ rotate: showEditProjects ? "180deg" : "0deg" }] }}
              />
            </Pressable>
            {showEditProjects ? (
              <View className="overflow-hidden rounded-2xl border border-border">
                {props.projects.map((project, index) => (
                  <ProjectOption
                    key={projectTodoScopeKey(project)}
                    first={index === 0}
                    isSelected={projectTodoScopeKey(project) === editProjectKey}
                    project={project}
                    onPress={() => {
                      setEditProjectKey(projectTodoScopeKey(project));
                      setShowEditProjects(false);
                    }}
                  />
                ))}
              </View>
            ) : null}
            <TodoStatusPicker
              accessibilityLabel="Edit task status"
              value={editStatus}
              onChange={setEditStatus}
            />
          </>
        ) : (
          <View className="flex-row items-center gap-2">
            <TodoStatusBadge status={props.todo.status} />
            <Text className="min-w-0 flex-1 text-xs text-foreground-muted" numberOfLines={1}>
              {props.projectTitle}
            </Text>
          </View>
        )}
      </View>
      {isEditing ? (
        <>
          <Pressable
            accessibilityLabel="Cancel editing task"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setEditDraft(props.todo.text);
              setEditProjectKey(projectTodoScopeKey(props.todo));
              setEditStatus(props.todo.status);
              setShowEditProjects(false);
              setIsEditing(false);
            }}
            className="p-1"
          >
            <SymbolView name="xmark" size={18} tintColor={mutedColor} type="monochrome" />
          </Pressable>
          <Pressable
            accessibilityLabel="Save edited task"
            accessibilityRole="button"
            disabled={!editDraft.trim()}
            hitSlop={8}
            onPress={() => void saveEdit()}
            className="p-1 disabled:opacity-40"
          >
            <SymbolView name="checkmark" size={18} tintColor={iconColor} type="monochrome" />
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityLabel="Edit task"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            setEditDraft(props.todo.text);
            setEditProjectKey(projectTodoScopeKey(props.todo));
            setEditStatus(props.todo.status);
            setShowEditProjects(false);
            setIsEditing(true);
          }}
          className="p-1"
        >
          <SymbolView name="pencil" size={18} tintColor={mutedColor} type="monochrome" />
        </Pressable>
      )}
      {isEditing ? null : (
        <Pressable
          accessibilityLabel="Delete task"
          accessibilityRole="button"
          hitSlop={8}
          onPress={confirmDelete}
          className="p-1"
        >
          <SymbolView name="trash" size={18} tintColor={mutedColor} type="monochrome" />
        </Pressable>
      )}
    </View>
  );
}
