import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Platform, TouchableOpacity } from "react-native";
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

const SWIPE_THRESHOLD = 40; // Swipe 40px to show buttons

type Props = {
  entry: QadaHistory;
  onComplete: (id: number) => void;
  onCompleteAll: (id: number) => void;
  onDelete: (id: number) => void;
};

type ActionButtonsProps = {
  drag: SharedValue<number>;
  entry: QadaHistory;
  t: (key: string, options?: any) => string;
  onComplete: () => void;
  onCompleteAll: () => void;
  onDelete: () => void;
  swipeableRef: React.RefObject<React.ComponentRef<typeof Swipeable> | null>;
};

const ActionButtons = ({
  drag,
  entry,
  t,
  onComplete,
  onCompleteAll,
  onDelete,
  swipeableRef,
}: ActionButtonsProps) => {
  const { isRTL } = useRTL();
  const theme = useTheme();
  const isAndroid = Platform.OS === PlatformType.ANDROID;

  const containerStyle = useAnimatedStyle(() => {
    const dragDistance = Math.abs(drag.value);
    const opacity = interpolate(dragDistance, [20, 80], [0, 1], Extrapolation.CLAMP);

    return { opacity };
  });

  const handleCompletePress = () => {
    onComplete();
    swipeableRef.current?.close();
  };

  const handleCompleteAllPress = () => {
    onCompleteAll();
    swipeableRef.current?.close();
  };

  const handleDeletePress = () => {
    onDelete();
    swipeableRef.current?.close();
  };

  const androidStyle = isAndroid ? { elevation: 10, zIndex: 10 } : {};

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="auto"
      style={[
        containerStyle,
        {
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingHorizontal: 8,
          gap: 8,
          ...androidStyle,
        },
      ]}>
      {/* Complete Button(s) */}
      {entry.count > 1 ? (
        <>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCompletePress}
            accessibilityLabel={t("common.complete")}
            style={{
              flexDirection: "column",
              backgroundColor: theme.success?.val,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
              minWidth: 64,
              minHeight: 56,
              gap: 2,
              ...androidStyle,
            }}>
            <Icon as={Check} size="sm" color={theme.typographyContrast?.val} />
            <Text color="$typographyContrast" size="2xs" fontWeight="600" numberOfLines={1}>
              {t("common.complete")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCompleteAllPress}
            accessibilityLabel={`${t("common.all")} (${formatNumberToLocale(entry.count.toString())})`}
            style={{
              flexDirection: "column",
              backgroundColor: theme.info?.val,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
              minWidth: 64,
              minHeight: 56,
              gap: 2,
              ...androidStyle,
            }}>
            <Icon as={CheckCheck} size="sm" color={theme.typographyContrast?.val} />
            <Text color="$typographyContrast" size="2xs" fontWeight="600" numberOfLines={1}>
              {t("common.all")} ({formatNumberToLocale(entry.count.toString())})
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCompletePress}
          accessibilityLabel={t("common.complete")}
          style={{
            flexDirection: "column",
            backgroundColor: theme.success?.val,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignItems: "center",
            justifyContent: "center",
            minWidth: 72,
            minHeight: 56,
            gap: 4,
            ...androidStyle,
          }}>
          <Icon as={Check} size="sm" color={theme.typographyContrast?.val} />
          <Text color="$typographyContrast" size="xs" fontWeight="600">
            {t("common.complete")}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleDeletePress}
        accessibilityLabel={t("common.delete")}
        style={{
          flexDirection: "column",
          backgroundColor: theme.error?.val,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          alignItems: "center",
          justifyContent: "center",
          minWidth: 72,
          minHeight: 56,
          gap: 4,
          ...androidStyle,
        }}>
        <Icon as={Trash2} size="sm" color={theme.typographyContrast?.val} />
        <Text color="$typographyContrast" size="xs" fontWeight="600">
          {t("common.delete")}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);

  const handleComplete = () => {
    onComplete(entry.id);
  };

  const handleCompleteAll = () => {
    onCompleteAll(entry.id);
  };

  const handleDelete = () => {
    onDelete(entry.id);
  };

  const renderActions = (_progress: SharedValue<number>, drag: SharedValue<number>) => {
    return (
      <ActionButtons
        drag={drag}
        entry={entry}
        t={t}
        onComplete={handleComplete}
        onCompleteAll={handleCompleteAll}
        onDelete={handleDelete}
        swipeableRef={swipeableRef}
      />
    );
  };

  // Use fixed swipe direction (left) for both LTR and RTL to work around
  // Android gesture handler bug where renderLeftActions doesn't receive touch events in RTL
  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderActions}
      renderLeftActions={undefined}
      overshootRight={true}
      overshootLeft={false}
      friction={2}
      rightThreshold={SWIPE_THRESHOLD}
      leftThreshold={undefined}
      enableTrackpadTwoFingerGesture={false}>
      <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
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
    </Swipeable>
  );
};
