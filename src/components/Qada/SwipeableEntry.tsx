import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LayoutChangeEvent, Platform, TouchableOpacity } from "react-native";
import { useTheme } from "tamagui";

// Components
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";

// Icons
import { CalendarDays, Check, Trash2, CheckCheck, MessageSquare } from "lucide-react-native";

// Stores
import { useAppStore } from "@/stores/app";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Types
import type { QadaHistory } from "@/services/qada-db";

// Utils
import { format } from "date-fns";
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale } from "@/utils/date";

// Enums
import { PlatformType } from "@/enums/app";

const SWIPE_THRESHOLD = 40;
const DRAG_OFFSET = 10;
const SPRING_CONFIG = { damping: 20, stiffness: 200, overshootClamping: true };

type Props = {
  entry: QadaHistory;
  onComplete: (id: number) => void;
  onCompleteAll: (id: number) => void;
  onDelete: (id: number) => void;
};

type ActionButtonsProps = {
  entry: QadaHistory;
  t: (key: string, options?: any) => string;
  onComplete: () => void;
  onCompleteAll: () => void;
  onDelete: () => void;
  onClose: () => void;
};

const ActionButtons = ({
  entry,
  t,
  onComplete,
  onCompleteAll,
  onDelete,
  onClose,
}: ActionButtonsProps) => {
  const theme = useTheme();
  const isAndroid = Platform.OS === PlatformType.ANDROID;
  const androidStyle = isAndroid ? { elevation: 10, zIndex: 10 } : {};

  const actionButtonStyle = (bgColor: string) => ({
    flexDirection: "column" as const,
    backgroundColor: bgColor,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minWidth: 64,
    minHeight: 56,
    gap: 4,
    ...androidStyle,
  });

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const handleCompleteAll = () => {
    onCompleteAll();
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <HStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$2"
      height="100%"
      collapsable={false}
      pointerEvents="auto">
      {entry.count > 1 ? (
        <>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleComplete}
            accessibilityRole="button"
            accessibilityLabel={t("common.complete")}
            accessibilityHint={t("a11y.qada.completeOneHint")}
            style={actionButtonStyle(theme.success?.val)}>
            <Icon as={Check} size="sm" color={theme.typographyContrast?.val} />
            <Text color="$typographyContrast" size="2xs" fontWeight="600" numberOfLines={1}>
              {t("common.complete")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCompleteAll}
            accessibilityRole="button"
            accessibilityLabel={`${t("common.all")} (${formatNumberToLocale(entry.count.toString())})`}
            accessibilityHint={t("a11y.qada.completeAllHint")}
            style={actionButtonStyle(theme.info?.val)}>
            <Icon as={CheckCheck} size="sm" color={theme.typographyContrast?.val} />
            <Text color="$typographyContrast" size="2xs" fontWeight="600" numberOfLines={1}>
              {t("common.all")} ({formatNumberToLocale(entry.count.toString())})
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleComplete}
          accessibilityRole="button"
          accessibilityLabel={t("common.complete")}
          accessibilityHint={t("a11y.qada.completeOneHint")}
          style={actionButtonStyle(theme.success?.val)}>
          <Icon as={Check} size="sm" color={theme.typographyContrast?.val} />
          <Text color="$typographyContrast" size="xs" fontWeight="600">
            {t("common.complete")}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={t("common.delete")}
        accessibilityHint={t("a11y.qada.deleteHint")}
        style={actionButtonStyle(theme.error?.val)}>
        <Icon as={Trash2} size="sm" color={theme.typographyContrast?.val} />
        <Text color="$typographyContrast" size="xs" fontWeight="600">
          {t("common.delete")}
        </Text>
      </TouchableOpacity>
    </HStack>
  );
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const locale = useAppStore((state) => state.locale);

  const translateX = useSharedValue(0);
  const offset = useSharedValue(0);
  const actionsWidth = useSharedValue(150);
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
    // Slide in from the edge: start offset by half the actions width, end at 0
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

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        style={{ overflow: "hidden", borderRadius: 24, direction: "ltr" }}>
        {/* Action buttons — absolutely positioned behind sliding content */}
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
          <ActionButtons
            entry={entry}
            t={t}
            onComplete={() => onComplete(entry.id)}
            onCompleteAll={() => onCompleteAll(entry.id)}
            onDelete={() => onDelete(entry.id)}
            onClose={close}
          />
        </Animated.View>

        {/* Entry content — slides to reveal actions */}
        <Animated.View style={[contentStyle, { direction: isRTL ? "rtl" : "ltr" }]}>
          <Box
            backgroundColor="$backgroundSecondary"
            borderRadius="$6"
            padding="$4"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.qada.entry", {
              count: entry.count,
              date: format(new Date(entry.created_at), "MMM dd, yyyy", {
                locale: getDateLocale(locale),
              }),
            })}
            accessibilityHint={t("a11y.qada.swipeHint")}>
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$3" alignItems="center" flex={1}>
                <Box
                  width={48}
                  height={48}
                  borderRadius={999}
                  backgroundColor="$backgroundPrimary"
                  alignItems="center"
                  justifyContent="center">
                  <Icon as={CalendarDays} color="$primary" />
                </Box>
                <VStack flex={1}>
                  <Text size="md" fontWeight="600" color="$typography">
                    {formatNumberToLocale(t("qada.daysCount", { count: entry.count }))}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {formatNumberToLocale(
                      format(new Date(entry.created_at), "MMM dd, yyyy", {
                        locale: getDateLocale(locale),
                      })
                    )}
                  </Text>
                  {entry.notes && (
                    <HStack gap="$1" alignItems="flex-start" marginTop="$2">
                      <Icon as={MessageSquare} size="xs" color="$primary" />
                      <Text size="xs" color="$typography" fontStyle="italic" flex={1}>
                        {entry.notes}
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </HStack>
            </HStack>
          </Box>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
