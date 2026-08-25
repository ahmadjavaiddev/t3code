import { StackActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { Image } from "expo-image";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import ImageViewing from "react-native-image-viewing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { CopyTextButton } from "../../components/CopyTextButton";
import { EmptyState } from "../../components/EmptyState";
import { ProjectFavicon } from "../../components/ProjectFavicon";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects } from "../../state/entities";
import { useProjectTodos } from "./ProjectTodoProvider";
import { projectTodoStatusLabel, type ProjectTodoStatus } from "./project-todos";

type ProjectTodoDetailsRouteParams = {
  readonly environmentId?: string;
  readonly projectId?: string;
  readonly todoId: string;
};

export function ProjectTodoDetailsRouteScreen({
  route,
}: StaticScreenProps<ProjectTodoDetailsRouteParams>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const todoStore = useProjectTodos();
  const iconColor = useThemeColor("--color-icon");
  const mutedColor = useThemeColor("--color-foreground-muted");
  const dangerColor = useThemeColor("--color-danger-foreground");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const todo = todoStore.todos.find((candidate) => candidate.id === route.params.todoId) ?? null;
  const project = projects.find(
    (candidate) =>
      candidate.environmentId === todo?.environmentId && candidate.id === todo?.projectId,
  );
  const projectTitle = project?.title ?? todo?.projectTitle ?? "Project";

  return (
    <View className="flex-1 bg-sheet" collapsable={false}>
      <NativeStackScreenOptions
        options={{ headerShown: Platform.OS !== "android", title: "Task details" }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Task details" onBack={() => navigation.goBack()} />
      ) : null}

      {!todo ? (
        <EmptyState
          detail="This task is no longer available."
          title="Task not found"
          variant="plain"
        />
      ) : (
        <>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
              gap: 20,
              paddingBottom: Math.max(insets.bottom, 18) + 18,
              paddingHorizontal: 18,
              paddingTop: 18,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {project ? (
                <ProjectFavicon
                  environmentId={project.environmentId}
                  faviconPath={project.faviconPath}
                  projectTitle={projectTitle}
                  size={36}
                  workspaceRoot={project.workspaceRoot}
                />
              ) : (
                <View className="size-9 items-center justify-center rounded-xl bg-subtle">
                  <SymbolView name="folder" size={18} tintColor={iconColor} type="monochrome" />
                </View>
              )}
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-base font-t3-bold text-foreground" numberOfLines={1}>
                  {projectTitle}
                </Text>
                <TodoDetailStatus status={todo.status} />
              </View>
              <CopyTextButton
                accessibilityLabel="Copy task or note"
                buttonSize={34}
                iconSize={19}
                text={todo.text}
                tintColor={mutedColor}
              />
              <Pressable
                accessibilityLabel="Edit task"
                accessibilityRole="button"
                className="size-[34px] items-center justify-center rounded-full bg-subtle active:opacity-60"
                onPress={() =>
                  navigation.dispatch(
                    StackActions.popTo("ProjectTodos", {
                      editTodoId: todo.id,
                      environmentId: route.params.environmentId,
                      projectId: route.params.projectId,
                    }),
                  )
                }
              >
                <SymbolView name="pencil" size={18} tintColor={iconColor} type="monochrome" />
              </Pressable>
            </View>

            <View className="gap-2">
              <Text className="px-1 text-sm font-t3-bold text-foreground-muted">Task or note</Text>
              <View className="rounded-2xl border border-border bg-card p-4">
                <Text className="text-base leading-relaxed text-foreground" selectable>
                  {todo.text}
                </Text>
              </View>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center gap-2 px-1">
                <SymbolView name="photo" size={15} tintColor={mutedColor} type="monochrome" />
                <Text className="text-sm font-t3-bold text-foreground-muted">
                  Attachments{todo.attachments.length > 0 ? ` (${todo.attachments.length})` : ""}
                </Text>
              </View>
              {todo.attachments.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 rounded-2xl border border-border bg-card p-3">
                  {todo.attachments.map((attachment, index) => (
                    <Pressable
                      key={attachment.id}
                      accessibilityLabel={`View image ${index + 1}`}
                      accessibilityRole="imagebutton"
                      className="aspect-square w-[31%] overflow-hidden rounded-xl bg-subtle"
                      onPress={() => setPreviewIndex(index)}
                    >
                      <Image
                        contentFit="cover"
                        source={{ uri: attachment.previewUri || attachment.dataUrl }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="items-center gap-2 rounded-2xl border border-border bg-card px-4 py-6">
                  <SymbolView name="photo" size={24} tintColor={mutedColor} type="monochrome" />
                  <Text className="text-sm text-foreground-muted">No attachments</Text>
                </View>
              )}
            </View>

            <View className="gap-2">
              <Text className="px-1 text-sm font-t3-bold text-foreground-muted">Details</Text>
              <View className="overflow-hidden rounded-2xl border border-border bg-card">
                <DetailRow label="Created" value={formatTodoTimestamp(todo.createdAt)} />
                <DetailRow label="Last updated" value={formatTodoTimestamp(todo.updatedAt)} last />
              </View>
            </View>

            <Pressable
              accessibilityLabel="Delete task"
              accessibilityRole="button"
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-danger-border bg-danger px-4 active:opacity-70"
              onPress={() =>
                Alert.alert("Delete this task?", todo.text, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      void todoStore.deleteTodo(todo).then(() => navigation.goBack());
                    },
                  },
                ])
              }
            >
              <SymbolView name="trash" size={18} tintColor={dangerColor} type="monochrome" />
              <Text className="text-sm font-t3-bold text-danger-foreground">Delete task</Text>
            </Pressable>
          </ScrollView>

          <ImageViewing
            doubleTapToZoomEnabled
            imageIndex={previewIndex ?? 0}
            images={todo.attachments.map((attachment) => ({
              uri: attachment.previewUri || attachment.dataUrl,
            }))}
            onRequestClose={() => setPreviewIndex(null)}
            swipeToCloseEnabled
            visible={previewIndex !== null}
          />
        </>
      )}
    </View>
  );
}

function TodoDetailStatus(props: { readonly status: ProjectTodoStatus }) {
  const mutedColor = useThemeColor("--color-foreground-muted");
  const icon = props.status === "completed" ? "checkmark.circle" : "circle";

  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={14} tintColor={mutedColor} type="monochrome" />
      <Text className="text-xs text-foreground-muted">{projectTodoStatusLabel(props.status)}</Text>
    </View>
  );
}

function DetailRow(props: {
  readonly label: string;
  readonly last?: boolean;
  readonly value: string;
}) {
  return (
    <View
      className={`flex-row items-center gap-4 px-4 py-3.5 ${props.last ? "" : "border-b border-border-subtle"}`}
    >
      <Text className="flex-1 text-sm text-foreground-muted">{props.label}</Text>
      <Text className="text-right text-sm text-foreground">{props.value}</Text>
    </View>
  );
}

function formatTodoTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
