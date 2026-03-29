import { FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LayoutChangeEvent, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useTheme } from "tamagui";

// Components
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";

// Icons
import { Trash2 } from "lucide-react-native";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

const SWIPE_THRESHOLD = 40;
const DRAG_OFFSET = 10;
const SPRING_CONFIG = { damping: 20, stiffness: 200, overshootClamping: true };

type Props = {
  onDelete: () => void;
  children: React.ReactNode;
};

const SwipeableMyAthkarCard: FC<Props> = ({ onDelete, children }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();

  const translateX = useSharedValue(0);
  const offset = useSharedValue(0);
  const actionsWidth = useSharedValue(80);
  const isRTLShared = useSharedValue(isRTL);
  isRTLShared.value = isRTL;

  const close = useCallback(() => {
    translateX.value = withSpring(0, SPRING_CONFIG);
    offset.value = 0;
  }, [translateX, offset]);

  const onActionsLayout = useCallback(
    (e: LayoutChangeEvent) => {
      actionsWidth.value = e.nativeEvent.layout.width;
    },
    [actionsWidth]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-DRAG_OFFSET, DRAG_OFFSET])
    .onUpdate((e) => {
      const pos = offset.value + e.translationX;
      translateX.value = isRTLShared.value
        ? Math.max(0, Math.min(actionsWidth.value, pos))
        : Math.min(0, Math.max(-actionsWidth.value, pos));
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        const target = (isRTLShared.value ? 1 : -1) * actionsWidth.value;
        translateX.value = withSpring(target, SPRING_CONFIG);
        offset.value = target;
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        offset.value = 0;
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (offset.value !== 0) {
      translateX.value = withSpring(0, SPRING_CONFIG);
      offset.value = 0;
    }
  });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsStyle = useAnimatedStyle(() => {
    const abs = Math.abs(translateX.value);
    const opacity = interpolate(abs, [20, 80], [0, 1], Extrapolation.CLAMP);
    const slide = interpolate(
      abs,
      [0, actionsWidth.value],
      [actionsWidth.value * 0.5, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateX: isRTLShared.value ? -slide : slide }],
    };
  });

  const handleDelete = () => {
    onDelete();
    close();
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        style={{ overflow: "hidden", borderRadius: 24, direction: "ltr" }}>
        {/* Delete action — behind the card */}
        <Animated.View
          onLayout={onActionsLayout}
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              direction: "ltr",
              ...(isRTL ? { left: 0 } : { right: 0 }),
            },
            actionsStyle,
          ]}>
          <HStack alignItems="center" gap="$2" paddingHorizontal="$2" height="100%">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={t("athkar.myAthkar.remove")}
              style={{
                flexDirection: "column",
                backgroundColor: theme.error?.val,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                alignItems: "center",
                justifyContent: "center",
                minWidth: 64,
                minHeight: 56,
                gap: 4,
              }}>
              <Icon as={Trash2} size="sm" color={theme.typographyContrast?.val} />
              <Text color="$typographyContrast" size="xs" fontWeight="600">
                {t("athkar.myAthkar.remove")}
              </Text>
            </TouchableOpacity>
          </HStack>
        </Animated.View>

        {/* Card content — slides to reveal delete */}
        <Animated.View style={[contentStyle, { direction: isRTL ? "rtl" : "ltr" }]}>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

export default SwipeableMyAthkarCard;
