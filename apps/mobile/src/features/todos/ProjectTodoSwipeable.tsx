import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import { View } from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { useThemeColor } from "../../lib/useThemeColor";
import { projectTodoStatusForSwipe, type ProjectTodoStatus } from "./project-todos";

const ACTION_WIDTH = 112;

export function ProjectTodoSwipeable(props: {
  readonly children: ReactNode;
  readonly status: ProjectTodoStatus;
  readonly onStatusChange: (status: ProjectTodoStatus) => void;
}) {
  const methodsRef = useRef<SwipeableMethods | null>(null);
  const cardColor = useThemeColor("--color-card");
  const { onStatusChange, status: currentStatus } = props;
  const handleStatusChange = useCallback(
    (direction: SwipeDirection) => {
      const status = projectTodoStatusForSwipe(direction);
      methodsRef.current?.close();
      if (status !== currentStatus) onStatusChange(status);
    },
    [currentStatus, onStatusChange],
  );

  return (
    <ReanimatedSwipeable
      ref={methodsRef}
      animationOptions={{
        damping: 26,
        mass: 0.7,
        overshootClamping: true,
        stiffness: 330,
      }}
      childrenContainerStyle={{ backgroundColor: cardColor }}
      dragOffsetFromLeftEdge={12}
      dragOffsetFromRightEdge={12}
      enableTrackpadTwoFingerGesture
      failOffsetY={[-10, 10]}
      friction={1}
      leftThreshold={ACTION_WIDTH * 0.55}
      onSwipeableOpen={handleStatusChange}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => <SwipeAction direction="right" />}
      renderRightActions={() => <SwipeAction direction="left" />}
      rightThreshold={ACTION_WIDTH * 0.55}
    >
      {props.children}
    </ReanimatedSwipeable>
  );
}

function SwipeAction(props: { readonly direction: "left" | "right" }) {
  const isDone = props.direction === "right";
  return (
    <View
      className={
        isDone
          ? "w-28 flex-1 items-center justify-center gap-1 bg-emerald-600 px-3"
          : "w-28 flex-1 items-center justify-center gap-1 bg-amber-600 px-3"
      }
    >
      <SymbolView
        name={isDone ? "checkmark.circle" : "clock"}
        size={20}
        tintColor="#ffffff"
        type="monochrome"
      />
      <Text className="text-xs font-t3-bold text-white">{isDone ? "Done" : "In progress"}</Text>
    </View>
  );
}
