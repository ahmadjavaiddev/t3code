import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
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
import { useThemeColor } from "../../lib/useThemeColor";
import { useProjectTodos } from "./ProjectTodoProvider";
import { projectTodoScopeKey, projectTodosForScope, type ProjectTodo } from "./project-todos";

type ProjectTodosRouteProps = StaticScreenProps<{
  readonly environmentId?: string;
  readonly projectId?: string;
}>;

export function ProjectTodosRouteScreen(props: ProjectTodosRouteProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const todoStore = useProjectTodos();
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");
  const dangerColor = useThemeColor("--color-danger-foreground");
  const primaryForegroundColor = useThemeColor("--color-primary-foreground");
  const [draft, setDraft] = useState("");
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

  useEffect(() => {
    if (routeScope) {
      setSelectedProjectKey(projectTodoScopeKey(routeScope));
      return;
    }
    if (
      selectedProjectKey === null ||
      !sortedProjects.some((project) => projectTodoScopeKey(project) === selectedProjectKey)
    ) {
      setSelectedProjectKey(sortedProjects[0] ? projectTodoScopeKey(sortedProjects[0]) : null);
    }
  }, [routeScope, selectedProjectKey, sortedProjects]);

  const selectedProject =
    scopedProject ??
    sortedProjects.find((project) => projectTodoScopeKey(project) === selectedProjectKey) ??
    null;
  const visibleTodos = useMemo(
    () => (routeScope ? projectTodosForScope(todoStore.todos, routeScope) : todoStore.todos),
    [routeScope, todoStore.todos],
  );
  const activeTodos = visibleTodos.filter((todo) => !todo.completed);
  const completedTodos = visibleTodos.filter((todo) => todo.completed);

  const submit = async () => {
    if (!selectedProject || !draft.trim()) return;
    if (await todoStore.addTodo(draft, selectedProject)) {
      setDraft("");
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
            {activeTodos.length > 0 ? (
              <TodoSection
                title="Open"
                todos={activeTodos}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onToggle={todoStore.toggleTodo}
              />
            ) : null}
            {completedTodos.length > 0 ? (
              <TodoSection
                title="Completed"
                todos={completedTodos}
                projects={projects}
                onDelete={todoStore.deleteTodo}
                onToggle={todoStore.toggleTodo}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
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
    <View
      className={`flex-row items-start gap-3 p-4 ${props.first ? "" : "border-t border-border"}`}
    >
      <Pressable
        accessibilityLabel={props.todo.completed ? "Mark task open" : "Mark task complete"}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: props.todo.completed }}
        hitSlop={8}
        onPress={() => void props.onToggle(props.todo)}
        className="pt-0.5"
      >
        <SymbolView
          name={props.todo.completed ? "checkmark.circle" : "circle"}
          size={22}
          tintColor={props.todo.completed ? iconColor : mutedColor}
          type="monochrome"
        />
      </Pressable>
      <View className="min-w-0 flex-1 gap-1">
        <Text
          className={
            props.todo.completed
              ? "text-base leading-normal text-foreground-muted line-through"
              : "text-base leading-normal"
          }
        >
          {props.todo.text}
        </Text>
        <Text className="text-xs text-foreground-muted" numberOfLines={1}>
          {props.projectTitle}
        </Text>
      </View>
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
  );
}
