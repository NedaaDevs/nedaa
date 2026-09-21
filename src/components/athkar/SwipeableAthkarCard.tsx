import { FC, useCallback, useEffect } from "react";
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

const SwipeableAthkarCard: FC<Props> = ({ onDelete, children }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();

  const translateX = useSharedValue(0);
  const offset = useSharedValue(0);
  const actionsWidth = useSharedValue(80);
  // Gesture worklets run on the UI thread and cannot read React context,
  // so the layout direction is mirrored into a shared value.
  const isRTLShared = useSharedValue(isRTL);
  useEffect(() => {
    isRTLShared.set(isRTL);
  }, [isRTL, isRTLShared]);

  const close = useCallback(() => {
    translateX.set(withSpring(0, SPRING_CONFIG));
    offset.set(0);
  }, [translateX, offset]);

  const onActionsLayout = useCallback(
    (e: LayoutChangeEvent) => {
      actionsWidth.set(e.nativeEvent.layout.width);
    },
    [actionsWidth]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-DRAG_OFFSET, DRAG_OFFSET])
    .onUpdate((e) => {
      const pos = offset.get() + e.translationX;
      translateX.set(
        isRTLShared.get()
          ? Math.max(0, Math.min(actionsWidth.get(), pos))
          : Math.min(0, Math.max(-actionsWidth.get(), pos))
      );
    })
    .onEnd(() => {
      if (Math.abs(translateX.get()) > SWIPE_THRESHOLD) {
        const target = (isRTLShared.get() ? 1 : -1) * actionsWidth.get();
        translateX.set(withSpring(target, SPRING_CONFIG));
        offset.set(target);
      } else {
        translateX.set(withSpring(0, SPRING_CONFIG));
        offset.set(0);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (offset.get() !== 0) {
      translateX.set(withSpring(0, SPRING_CONFIG));
      offset.set(0);
    }
  });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const actionsStyle = useAnimatedStyle(() => {
    const abs = Math.abs(translateX.get());
    const opacity = interpolate(abs, [20, 80], [0, 1], Extrapolation.CLAMP);
    const slide = interpolate(
      abs,
      [0, actionsWidth.get()],
      [actionsWidth.get() * 0.5, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateX: isRTLShared.get() ? -slide : slide }],
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

export default SwipeableAthkarCard;
