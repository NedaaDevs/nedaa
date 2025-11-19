import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useSharedValue,
  interpolateColor,
} from "react-native-reanimated";
import { I18nManager, Dimensions } from "react-native";

// Components
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";

// Icons
import { CalendarDays } from "lucide-react-native";

// Types
import type { QadaHistory } from "@/services/qada-db";

// Utils
import { format } from "date-fns";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // Swipe 25% of screen width to trigger delete/complete one
const COMPLETE_ALL_THRESHOLD = SCREEN_WIDTH * 0.45; // Swipe 45% of screen width to trigger complete all
const TEXT_TRANSITION_POINT = SCREEN_WIDTH * 0.35; // Switch text at 35% of screen width

type Props = {
  entry: QadaHistory;
  onComplete: (id: number) => void;
  onCompleteAll: () => void;
  onDelete: (id: number) => void;
};

type RightActionsProps = {
  drag: SharedValue<number>;
  entry: QadaHistory;
  lastDragValue: SharedValue<number>;
  t: (key: string, options?: any) => string;
  physicalSide: "left" | "right";
};

type LeftActionsProps = {
  drag: SharedValue<number>;
  lastDragValue: SharedValue<number>;
  t: (key: string, options?: any) => string;
  physicalSide: "left" | "right";
};

const RightActions = ({ drag, entry, lastDragValue, t, physicalSide }: RightActionsProps) => {
  const containerStyle = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    // Track the maximum drag distance
    if (dragDistance > Math.abs(lastDragValue.value)) {
      lastDragValue.value = drag.value;
    }

    const backgroundColor =
      entry.count > 1
        ? interpolateColor(dragDistance, [0, COMPLETE_ALL_THRESHOLD], ["#22c55e", "#3b82f6"])
        : "#22c55e";

    return { backgroundColor };
  });

  const textStyle = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    const opacity = interpolate(dragDistance, [20, 80], [0, 1], Extrapolation.CLAMP);

    return { opacity };
  });

  const completeOneOpacity = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    if (entry.count <= 1) {
      return { opacity: 1, display: "flex" };
    }

    if (dragDistance >= TEXT_TRANSITION_POINT) {
      return { opacity: 0, display: "none" };
    }

    return { opacity: 1, display: "flex" };
  });

  const completeAllOpacity = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    if (entry.count <= 1 || dragDistance < TEXT_TRANSITION_POINT) {
      return { opacity: 0, display: "none" };
    }

    return { opacity: 1, display: "flex" };
  });

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          height: 60,
          marginLeft: 8,
          width: SCREEN_WIDTH,
          borderRadius: 12,
          justifyContent: "center",
          alignItems: physicalSide === "right" ? "flex-end" : "flex-start",
          paddingHorizontal: 20,
        },
      ]}>
      <Animated.View style={textStyle}>
        <Animated.View style={completeOneOpacity}>
          <Text className="text-background text-base font-semibold">
            {t("qada.swipeCompleteOne")}
          </Text>
        </Animated.View>
        {entry.count > 1 && (
          <Animated.View style={completeAllOpacity}>
            <Text className="text-background text-base font-semibold">
              {t("qada.swipeCompleteAll", { count: entry.count })}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const LeftActions = ({ drag, lastDragValue, t, physicalSide }: LeftActionsProps) => {
  const containerStyle = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    // Track the maximum drag distance
    if (dragDistance > Math.abs(lastDragValue.value)) {
      lastDragValue.value = drag.value;
    }

    return {
      backgroundColor: "#ef4444",
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);

    const opacity = interpolate(dragDistance, [20, 80], [0, 1], Extrapolation.CLAMP);

    return { opacity };
  });

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          height: 60,
          marginRight: 8,
          width: SCREEN_WIDTH,
          justifyContent: "center",
          alignItems: physicalSide === "left" ? "flex-start" : "flex-end",
          paddingHorizontal: 20,
          borderRadius: 12,
        },
      ]}>
      <Animated.View style={textStyle}>
        <Text className="text-background text-base font-semibold">{t("qada.swipeDelete")}</Text>
      </Animated.View>
    </Animated.View>
  );
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);
  const lastDragValue = useSharedValue(0);

  const handleDelete = () => {
    onDelete(entry.id);
  };

  const handleComplete = () => {
    onComplete(entry.id);
  };

  const handleCompleteAll = () => {
    onCompleteAll();
  };

  const handleSwipeableWillOpen = (direction: "left" | "right") => {
    const isRTL = I18nManager.isRTL;
    const effectiveDirection = isRTL ? (direction === "left" ? "right" : "left") : direction;

    const dragDistance = Math.abs(lastDragValue.value);

    if (effectiveDirection === "right") {
      handleDelete();
    } else if (effectiveDirection === "left") {
      if (entry.count > 1 && dragDistance >= COMPLETE_ALL_THRESHOLD) {
        handleCompleteAll();
      } else {
        handleComplete();
      }
    }

    lastDragValue.value = 0;
    swipeableRef.current?.close();
  };

  const isRTL = I18nManager.isRTL;

  const renderRightActions = (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    return (
      <RightActions
        drag={drag}
        entry={entry}
        lastDragValue={lastDragValue}
        t={t}
        physicalSide={isRTL ? "left" : "right"}
      />
    );
  };

  const renderLeftActions = (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    return (
      <LeftActions
        drag={drag}
        lastDragValue={lastDragValue}
        t={t}
        physicalSide={isRTL ? "right" : "left"}
      />
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={SWIPE_THRESHOLD}
      leftThreshold={SWIPE_THRESHOLD}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      enableTrackpadTwoFingerGesture={false}>
      <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
        <HStack className="justify-between items-center">
          <HStack space="md" className="items-center flex-1">
            <Box className="w-12 h-12 rounded-full bg-accent-primary/20 items-center justify-center">
              <Icon as={CalendarDays} className="text-accent-primary" />
            </Box>
            <VStack className="flex-1">
              <Text className="text-base font-semibold text-typography text-left">
                {t("qada.daysCount", { count: entry.count })}
              </Text>
              <Text className="text-xs text-typography-secondary text-left">
                {format(new Date(entry.created_at), "MMM dd, yyyy")}
              </Text>
              {entry.notes && (
                <Text className="text-xs text-typography-secondary mt-1 text-left">
                  {entry.notes}
                </Text>
              )}
            </VStack>
          </HStack>
        </HStack>
      </Box>
    </Swipeable>
  );
};
