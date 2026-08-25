import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { StackActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { EmptyState } from "../../components/EmptyState";
import { SymbolView } from "../../components/AppSymbol";
import { scopedProjectKey, scopedThreadKey } from "../../lib/scopedEntities";
import { relativeTime } from "../../lib/time";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects, useThreadShells } from "../../state/entities";
import { mergeComposerDraftContent } from "../../state/use-composer-drafts";
import { useProjectTodos } from "./ProjectTodoProvider";
import { projectTodoAgentThreads } from "./project-todos";

type TodoAgentThreadPickerRouteParams = {
  readonly todoId: string;
};

type ThreadTarget =
  | { readonly kind: "new" }
  | { readonly kind: "thread"; readonly thread: EnvironmentThreadShell };

type ThreadFilter = "unsettled" | "settled";

export function TodoAgentThreadPickerRouteScreen({
  route,
}: StaticScreenProps<TodoAgentThreadPickerRouteParams>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const threadShells = useThreadShells();
  const todoStore = useProjectTodos();
  const [preparingTarget, setPreparingTarget] = useState<string | null>(null);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("unsettled");
  const [classificationNow] = useState(() => new Date().toISOString());
  const todo = todoStore.todos.find((candidate) => candidate.id === route.params.todoId) ?? null;
  const project = projects.find(
    (candidate) =>
      candidate.environmentId === todo?.environmentId && candidate.id === todo?.projectId,
  );
  const projectTitle = project?.title ?? todo?.projectTitle ?? "Project";
  const matchingThreads = useMemo(
    () =>
      todo
        ? projectTodoAgentThreads(threadShells, todo, {
            filter: threadFilter,
            now: classificationNow,
          })
        : [],
    [classificationNow, threadFilter, threadShells, todo],
  );
  const targets = useMemo<ReadonlyArray<ThreadTarget>>(
    () => [
      { kind: "new" },
      ...matchingThreads.map((thread) => ({ kind: "thread" as const, thread })),
    ],
    [matchingThreads],
  );

  const prepareDraft = async (draftKey: string): Promise<void> => {
    if (!todo) return;
    try {
      await mergeComposerDraftContent(draftKey, {
        text: todo.text,
        attachments: todo.attachments,
      });
    } catch (error) {
      // The in-memory draft is published before persistence is attempted, so
      // navigation remains safe even when this best-effort write fails.
      console.warn("[project-todos] failed to persist agent draft", error);
    }
  };

  const openNewThread = async () => {
    if (preparingTarget !== null || !todo) return;
    setPreparingTarget("new");
    await prepareDraft(`new-task:${scopedProjectKey(todo.environmentId, todo.projectId)}`);
    navigation.dispatch(
      StackActions.replace("NewTaskSheet", {
        screen: "NewTaskDraft",
        params: {
          environmentId: String(todo.environmentId),
          projectId: String(todo.projectId),
          title: projectTitle,
        },
      }),
    );
  };

  const openThread = async (thread: EnvironmentThreadShell) => {
    const targetKey = String(thread.id);
    if (preparingTarget !== null) return;
    setPreparingTarget(targetKey);
    await prepareDraft(scopedThreadKey(thread.environmentId, thread.id));
    navigation.dispatch(
      StackActions.replace("Thread", {
        environmentId: String(thread.environmentId),
        threadId: String(thread.id),
      }),
    );
  };

  return (
    <View className="flex-1 bg-sheet" collapsable={false}>
      <NativeStackScreenOptions
        options={{ headerShown: Platform.OS !== "android", title: "Send to agent" }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Send to agent" onBack={() => navigation.goBack()} />
      ) : null}

      {!todo ? (
        <EmptyState
          detail="This task is no longer available."
          title="Task not found"
          variant="plain"
        />
      ) : (
        <FlatList
          data={targets}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 18) + 18,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
          keyExtractor={(target) =>
            target.kind === "new" ? "new" : `${target.thread.environmentId}:${target.thread.id}`
          }
          ListHeaderComponent={
            <View className="mb-2 gap-[18px]">
              <View className="gap-1 rounded-2xl border border-border bg-subtle px-4 py-3">
                <Text className="text-xs font-t3-bold text-foreground-muted">{projectTitle}</Text>
                <Text className="text-sm leading-normal text-foreground" numberOfLines={3}>
                  {todo.text}
                </Text>
                {todo.attachments.length > 0 ? (
                  <Text className="text-xs text-foreground-muted">
                    {todo.attachments.length} attachment
                    {todo.attachments.length === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
              <View className="gap-2">
                <Text className="px-1 text-sm font-t3-bold text-foreground-muted">
                  Choose a thread
                </Text>
                <ThreadFilterControl value={threadFilter} onChange={setThreadFilter} />
              </View>
            </View>
          }
          ListFooterComponent={
            matchingThreads.length === 0 ? (
              <Text className="px-1 pt-2 text-xs leading-normal text-foreground-muted">
                {threadFilter === "unsettled"
                  ? "This project has no unsettled threads. Start a new one or view settled threads."
                  : "This project has no settled threads."}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            const thread = item.kind === "thread" ? item.thread : null;
            return (
              <ThreadTargetRow
                disabled={preparingTarget !== null}
                icon={thread ? "text.bubble" : "plus"}
                isFirst={index === 0}
                isLast={index === targets.length - 1}
                subtitle={
                  thread
                    ? [
                        thread.branch,
                        relativeTime(
                          thread.latestUserMessageAt ?? thread.updatedAt ?? thread.createdAt,
                        ),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : `Start in ${projectTitle}`
                }
                title={thread?.title ?? "New thread"}
                onPress={() => (thread ? void openThread(thread) : void openNewThread())}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function ThreadFilterControl(props: {
  readonly value: ThreadFilter;
  readonly onChange: (value: ThreadFilter) => void;
}) {
  const options = ["unsettled", "settled"] as const;

  return (
    <View className="flex-row overflow-hidden rounded-full bg-card">
      {options.map((option) => {
        const selected = props.value === option;
        return (
          <Pressable
            key={option}
            accessibilityLabel={`${option === "unsettled" ? "Unsettled" : "Settled"} threads`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={
              selected
                ? "flex-1 items-center rounded-full bg-subtle-strong py-2"
                : "flex-1 items-center py-2"
            }
            onPress={() => props.onChange(option)}
          >
            <Text
              className={
                selected
                  ? "text-sm font-t3-medium text-foreground"
                  : "text-sm text-foreground-muted"
              }
            >
              {option === "unsettled" ? "Unsettled" : "Settled"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ThreadTargetRow(props: {
  readonly disabled: boolean;
  readonly icon: "plus" | "text.bubble";
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onPress: () => void;
  readonly subtitle: string;
  readonly title: string;
}) {
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");

  return (
    <Pressable
      accessibilityHint="Prefills this task in the agent composer"
      accessibilityLabel={props.title}
      accessibilityRole="button"
      className={`min-h-16 flex-row items-center gap-3 border-x border-border bg-card px-4 py-3 active:bg-subtle ${
        props.isFirst ? "rounded-t-2xl border-t" : "border-t border-border-subtle"
      } ${props.isLast ? "rounded-b-2xl border-b" : ""}`}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{ opacity: props.disabled ? 0.5 : 1 }}
    >
      <View className="size-9 items-center justify-center rounded-full bg-subtle">
        <SymbolView name={props.icon} size={18} tintColor={iconColor} type="monochrome" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-base font-t3-medium text-foreground" numberOfLines={1}>
          {props.title}
        </Text>
        <Text className="text-xs text-foreground-muted" numberOfLines={1}>
          {props.subtitle}
        </Text>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={mutedColor} type="monochrome" />
    </Pressable>
  );
}
