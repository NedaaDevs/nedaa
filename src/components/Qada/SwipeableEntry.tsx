import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { I18nManager, Platform, TouchableOpacity } from "react-native";

// Components
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";

// Icons
import { CalendarDays, Check, Trash2, CheckCheck, MessageSquare } from "lucide-react-native";

// Types
import type { QadaHistory } from "@/services/qada-db";

// Utils
import { format } from "date-fns";
import { formatNumberToLocale } from "@/utils/number";

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
  const isRTL = I18nManager.isRTL;
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
        <Box
          collapsable={false}
          style={{
            gap: 4,
            ...androidStyle,
          }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCompletePress}
            style={{
              backgroundColor: "#10b981",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              alignItems: "center",
              justifyContent: "center",
              minWidth: 80,
              ...androidStyle,
            }}>
            <HStack space="xs" className="items-center gap-1">
              <Icon as={Check} size="sm" className="text-background" />
              <Text className="text-background text-xs font-semibold">{t("common.complete")}</Text>
            </HStack>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCompleteAllPress}
            style={{
              backgroundColor: "#3b82f6",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              alignItems: "center",
              justifyContent: "center",
              minWidth: 80,
              ...androidStyle,
            }}>
            <HStack space="xs" className="items-center gap-1">
              <Icon as={CheckCheck} size="sm" className="text-background" />
              <Text className="text-background text-xs font-semibold">
                {t("common.all")} ({formatNumberToLocale(entry.count.toString())})
              </Text>
            </HStack>
          </TouchableOpacity>
        </Box>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCompletePress}
          style={{
            backgroundColor: "#10b981",
            borderRadius: 8,
            paddingHorizontal: 16,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            minWidth: 100,
            ...androidStyle,
          }}>
          <HStack space="xs" className="items-center gap-1">
            <Icon as={Check} size="sm" className="text-background" />
            <Text className="text-background text-sm font-semibold">{t("common.complete")}</Text>
          </HStack>
        </TouchableOpacity>
      )}

      {/* Delete Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleDeletePress}
        style={{
          backgroundColor: "#ef4444",
          borderRadius: 8,
          paddingHorizontal: 16,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          minWidth: 100,
          ...androidStyle,
        }}>
        <HStack space="xs" className="items-center gap-1">
          <Icon as={Trash2} size="sm" className="text-background" />
          <Text className="text-background text-sm font-semibold">{t("common.delete")}</Text>
        </HStack>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
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
      <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
        <HStack className="justify-between items-center">
          <HStack space="md" className="items-center flex-1">
            <Box className="w-12 h-12 rounded-full bg-accent-primary/20 items-center justify-center">
              <Icon as={CalendarDays} className="text-accent-primary" />
            </Box>
            <VStack className="flex-1">
              <Text className="text-base font-semibold text-typography text-left">
                {formatNumberToLocale(t("qada.daysCount", { count: entry.count }))}
              </Text>
              <Text className="text-xs text-typography-secondary text-left">
                {format(new Date(entry.created_at), "MMM dd, yyyy")}
              </Text>
              {entry.notes && (
                <HStack space="xs" className="items-start mt-2">
                  <Icon as={MessageSquare} size="xs" className="text-accent-primary mt-0.5" />
                  <Text className="text-xs text-typography italic flex-1 text-left">
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
