import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { LegendList, type LegendListRenderItemProps } from "@legendapp/list/react-native";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, View } from "react-native";
import { KeyboardController, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { EmptyState } from "../../components/EmptyState";
import { pickComposerImages, type DraftComposerImageAttachment } from "../../lib/composerImages";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects } from "../../state/entities";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import {
  appendComposerDraftAttachments,
  clearComposerDraft,
  isComposerDraftEmpty,
  loadComposerDraftSnapshot,
  removeComposerDraftAttachment,
  replaceComposerDraftAttachments,
  setComposerDraftText,
} from "../../state/use-composer-drafts";
import { ProjectTodoComposer } from "./ProjectTodoComposer";
import { useProjectTodos } from "./ProjectTodoProvider";
import { ProjectTodoSwipeable } from "./ProjectTodoSwipeable";
import {
  projectTodoScopeKey,
  projectTodoSections,
  projectTodoStatusLabel,
  projectTodosForScope,
  projectTodoCreateComposerDraftKey,
  projectTodoEditComposerDraftKey,
  type ProjectTodo,
  type ProjectTodoStatus,
} from "./project-todos";

type ProjectTodosRouteProps = StaticScreenProps<{
  readonly environmentId?: string;
  readonly editTodoId?: string;
  readonly projectId?: string;
}>;

type ProjectTodoListItem =
  | {
      readonly kind: "section";
      readonly key: string;
      readonly first: boolean;
      readonly title: string;
    }
  | {
      readonly kind: "todo";
      readonly key: string;
      readonly first: boolean;
      readonly last: boolean;
      readonly projectTitle: string;
      readonly todo: ProjectTodo;
    };

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
  const [composerDraftKey, setComposerDraftKey] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<
    ReadonlyArray<DraftComposerImageAttachment>
  >([]);
  const [composerProjectKey, setComposerProjectKey] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<ProjectTodoStatus>("todo");
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const handledEditTodoIdRef = useRef<string | null>(null);

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
  const todoSections = useMemo(() => projectTodoSections(visibleTodos), [visibleTodos]);
  const todoListItems = useMemo<ReadonlyArray<ProjectTodoListItem>>(() => {
    const projectTitles = new Map(
      projects.map((project) => [projectTodoScopeKey(project), project.title] as const),
    );
    const populatedSections = todoSections.filter((section) => section.todos.length > 0);
    return populatedSections.flatMap((section, sectionIndex) => [
      {
        kind: "section" as const,
        key: `section:${section.status}`,
        first: sectionIndex === 0,
        title: section.title,
      },
      ...section.todos.map((todo, index) => ({
        kind: "todo" as const,
        key: todo.id,
        first: index === 0,
        last: index === section.todos.length - 1,
        projectTitle: projectTitles.get(projectTodoScopeKey(todo)) ?? todo.projectTitle,
        todo,
      })),
    ]);
  }, [projects, todoSections]);
  const canSubmitComposer =
    composerDraft.trim().length > 0 && (editingTodo !== null || composerProject !== null);

  const closeComposer = () => {
    void KeyboardController.dismiss({ animated: true });
    setComposerOpen(false);
    setEditingTodo(null);
    setComposerDraftKey(null);
    setComposerSubmitting(false);
  };

  const openCreateComposer = async () => {
    if (!selectedProject) return;
    const draftKey = projectTodoCreateComposerDraftKey({
      environmentId: selectedProject.environmentId,
      projectId: selectedProject.id,
    });
    const draft = await loadComposerDraftSnapshot(draftKey);
    setEditingTodo(null);
    setComposerDraftKey(draftKey);
    setComposerDraft(draft.text);
    setComposerAttachments(draft.attachments);
    setComposerProjectKey(projectTodoScopeKey(selectedProject));
    setComposerStatus("todo");
    setComposerOpen(true);
  };

  const openEditComposer = async (todo: ProjectTodo) => {
    const draftKey = projectTodoEditComposerDraftKey(todo);
    const draft = await loadComposerDraftSnapshot(draftKey);
    const hasDraft = !isComposerDraftEmpty(draft);
    if (!hasDraft) {
      setComposerDraftText(draftKey, todo.text);
      replaceComposerDraftAttachments(draftKey, todo.attachments);
    }
    setEditingTodo(todo);
    setComposerDraftKey(draftKey);
    setComposerDraft(hasDraft ? draft.text : todo.text);
    setComposerAttachments(hasDraft ? draft.attachments : todo.attachments);
    setComposerProjectKey(projectTodoScopeKey(todo));
    setComposerStatus(todo.status);
    setComposerOpen(true);
  };

  const editTodoId = props.route.params?.editTodoId;
  useEffect(() => {
    if (!editTodoId) {
      handledEditTodoIdRef.current = null;
      return;
    }
    if (todoStore.isLoading || handledEditTodoIdRef.current === editTodoId) return;

    handledEditTodoIdRef.current = editTodoId;
    navigation.setParams({ editTodoId: undefined });
    const todo = todoStore.todos.find((candidate) => candidate.id === editTodoId);
    if (todo) void openEditComposer(todo);
  }, [editTodoId, navigation, todoStore.isLoading, todoStore.todos]);

  const selectComposerProject = async (projectKey: string) => {
    const nextProject = sortedProjects.find(
      (project) => projectTodoScopeKey(project) === projectKey,
    );
    if (!nextProject) return;
    if (!editingTodo) {
      const nextDraftKey = projectTodoCreateComposerDraftKey({
        environmentId: nextProject.environmentId,
        projectId: nextProject.id,
      });
      const nextDraft = await loadComposerDraftSnapshot(nextDraftKey);
      if (
        isComposerDraftEmpty(nextDraft) &&
        (composerDraft.trim().length > 0 || composerAttachments.length > 0)
      ) {
        setComposerDraftText(nextDraftKey, composerDraft);
        replaceComposerDraftAttachments(nextDraftKey, composerAttachments);
      } else {
        setComposerDraft(nextDraft.text);
        setComposerAttachments(nextDraft.attachments);
      }
      setComposerDraftKey(nextDraftKey);
    }
    setComposerProjectKey(projectKey);
    if (editingTodo || routeScope) return;
    setSelectedProjectKey(projectKey);
    savePreferences({ projectTodosLastSelectedProjectKey: projectKey });
  };

  const submitComposer = async () => {
    if (!canSubmitComposer || composerSubmitting) return;
    setComposerSubmitting(true);
    const saved = editingTodo
      ? await todoStore.updateTodo(
          editingTodo,
          composerDraft,
          composerProject,
          composerStatus,
          composerAttachments,
        )
      : composerProject
        ? await todoStore.addTodo(
            composerDraft,
            composerProject,
            composerStatus,
            composerAttachments,
          )
        : false;
    if (saved) {
      if (composerDraftKey) clearComposerDraft(composerDraftKey);
      closeComposer();
    } else setComposerSubmitting(false);
  };

  const changeTodoStatus = useCallback(
    async (todo: ProjectTodo, status: ProjectTodoStatus) => {
      if (todo.status === status) return;
      await todoStore.updateTodo(todo, todo.text, null, status, todo.attachments);
    },
    [todoStore.updateTodo],
  );

  const sendTodoToAgent = useCallback(
    (todo: ProjectTodo) => {
      navigation.navigate("TodoAgentThreadPicker", { todoId: todo.id });
    },
    [navigation],
  );

  const openTodoDetails = useCallback(
    (todo: ProjectTodo) => {
      navigation.navigate("ProjectTodoDetails", {
        todoId: todo.id,
        environmentId: routeEnvironmentId ?? undefined,
        projectId: routeProjectId ?? undefined,
      });
    },
    [navigation, routeEnvironmentId, routeProjectId],
  );

  const addComposerImages = async () => {
    const result = await pickComposerImages({ existingCount: composerAttachments.length });
    if (result.images.length > 0) {
      setComposerAttachments((current) => [...current, ...result.images]);
      if (composerDraftKey) appendComposerDraftAttachments(composerDraftKey, result.images);
    }
    if (result.error) {
      Alert.alert("Could not add image", result.error);
    }
  };

  const renderTodoListItem = useCallback(
    ({ item }: LegendListRenderItemProps<ProjectTodoListItem>) => {
      if (item.kind === "section") {
        return (
          <Text
            className={`${item.first ? "" : "mt-6"} mb-2 px-1 text-sm font-t3-bold text-foreground-muted`}
          >
            {item.title}
          </Text>
        );
      }

      return (
        <View
          className={`overflow-hidden border-x border-border bg-card ${item.first ? "rounded-t-[22px] border-t" : ""} ${item.last ? "rounded-b-[22px] border-b" : ""}`}
        >
          <TodoRow
            first={item.first}
            todo={item.todo}
            projectTitle={item.projectTitle}
            onSendToAgent={sendTodoToAgent}
            onStatusChange={changeTodoStatus}
            onToggle={todoStore.toggleTodo}
            onView={openTodoDetails}
          />
        </View>
      );
    },
    [changeTodoStatus, openTodoDetails, sendTodoToAgent, todoStore.toggleTodo],
  );

  return (
    <View className="flex-1 bg-sheet">
      <NativeStackScreenOptions
        options={{ headerShown: Platform.OS !== "android", title: "Tasks & notes" }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Tasks & notes" onBack={() => navigation.goBack()} />
      ) : null}

      <LegendList
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 92,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
        data={todoStore.isLoading ? [] : todoListItems}
        drawDistance={300}
        estimatedItemSize={112}
        getItemType={(item) => item.kind}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          todoStore.isLoading ? (
            <View className="items-center gap-3 py-10">
              <ActivityIndicator />
              <Text className="text-sm text-foreground-muted">Loading tasks…</Text>
            </View>
          ) : (
            <EmptyState
              variant="plain"
              title={
                routeScope
                  ? `No tasks for ${scopedProject?.title ?? "this project"}`
                  : "No tasks yet"
              }
              detail="Tap the compose button to add a task or note."
            />
          )
        }
        ListHeaderComponent={
          todoStore.error ? (
            <Pressable
              accessibilityRole="button"
              onPress={todoStore.dismissError}
              className="mb-6 flex-row items-center gap-3 rounded-2xl border border-border bg-subtle p-4"
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
          ) : null
        }
        renderItem={renderTodoListItem}
        showsVerticalScrollIndicator={false}
      />

      {!composerOpen ? (
        <Pressable
          accessibilityLabel="Add task or note"
          accessibilityRole="button"
          disabled={selectedProject === null}
          onPress={() => void openCreateComposer()}
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
              attachments={composerAttachments}
              canSubmit={canSubmitComposer}
              isEditing={editingTodo !== null}
              project={composerProject}
              projectFallbackTitle={editingTodo?.projectTitle ?? null}
              projectSelectionLocked={routeScope !== null && editingTodo === null}
              projects={sortedProjects}
              status={composerStatus}
              submitting={composerSubmitting}
              text={composerDraft}
              onAddImages={() => void addComposerImages()}
              onChangeProject={(projectKey) => void selectComposerProject(projectKey)}
              onChangeStatus={setComposerStatus}
              onChangeText={(text) => {
                setComposerDraft(text);
                if (composerDraftKey) setComposerDraftText(composerDraftKey, text);
              }}
              onClose={closeComposer}
              onRemoveImage={(imageId) => {
                setComposerAttachments((current) =>
                  current.filter((attachment) => attachment.id !== imageId),
                );
                if (composerDraftKey) removeComposerDraftAttachment(composerDraftKey, imageId);
              }}
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

function TodoRow(props: {
  readonly todo: ProjectTodo;
  readonly projectTitle: string;
  readonly first: boolean;
  readonly onToggle: (todo: ProjectTodo) => Promise<void>;
  readonly onSendToAgent: (todo: ProjectTodo) => void;
  readonly onStatusChange: (todo: ProjectTodo, status: ProjectTodoStatus) => Promise<void>;
  readonly onView: (todo: ProjectTodo) => void;
}) {
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");

  return (
    <ProjectTodoSwipeable
      status={props.todo.status}
      onSendToAgent={() => props.onSendToAgent(props.todo)}
      onStatusChange={(status) => void props.onStatusChange(props.todo, status)}
    >
      <View
        className={`flex-row items-start gap-3 overflow-hidden bg-card p-4 ${props.first ? "" : "border-t border-border"}`}
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
            name={props.todo.status === "completed" ? "checkmark.circle" : "circle"}
            size={22}
            tintColor={props.todo.status === "completed" ? iconColor : mutedColor}
            type="monochrome"
          />
        </Pressable>
        <Pressable
          accessibilityHint="Opens the full task text, project, status, and images"
          accessibilityLabel={`View task details: ${props.todo.text}${
            props.todo.attachments.length > 0
              ? `, ${props.todo.attachments.length} attachment${props.todo.attachments.length === 1 ? "" : "s"}`
              : ""
          }`}
          accessibilityRole="button"
          className="min-w-0 flex-1 gap-1"
          onPress={() => props.onView(props.todo)}
        >
          <Text
            ellipsizeMode="tail"
            numberOfLines={3}
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
            <Text className="min-w-0 shrink text-xs text-foreground-muted" numberOfLines={1}>
              {props.projectTitle}
            </Text>
            {props.todo.attachments.length > 0 ? (
              <View className="shrink-0 flex-row items-center gap-1">
                <SymbolView name="photo" size={12} tintColor={mutedColor} type="monochrome" />
                <Text className="text-2xs font-t3-medium text-foreground-muted">
                  {props.todo.attachments.length} attachment
                  {props.todo.attachments.length === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </ProjectTodoSwipeable>
  );
}
