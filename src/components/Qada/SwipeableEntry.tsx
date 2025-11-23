import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { I18nManager } from "react-native";

// Components
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { CalendarDays, Check, Trash2, CheckCheck, MessageSquare } from "lucide-react-native";

// Types
import type { QadaHistory } from "@/services/qada-db";

// Utils
import { format } from "date-fns";
import { formatNumberToLocale } from "@/utils/number";

const SWIPE_THRESHOLD = 40; // Swipe 40px to show buttons

type Props = {
  entry: QadaHistory;
  onComplete: (id: number) => void;
  onCompleteAll: () => void;
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

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 8,
          gap: 8,
        },
      ]}>
      {/* Complete Button(s) */}
      {entry.count > 1 ? (
        <VStack space="xs" className="gap-1">
          <Pressable
            onPress={handleCompletePress}
            className="bg-success rounded-lg px-3 py-2.5 items-center justify-center">
            <HStack space="xs" className="items-center gap-1">
              <Icon as={Check} size="sm" className="text-background" />
              <Text className="text-background text-xs font-semibold">{t("common.complete")}</Text>
            </HStack>
          </Pressable>
          <Pressable
            onPress={handleCompleteAllPress}
            className="bg-info rounded-lg px-3 py-2.5 items-center justify-center">
            <HStack space="xs" className="items-center gap-1">
              <Icon as={CheckCheck} size="sm" className="text-background" />
              <Text className="text-background text-xs font-semibold">
                {t("common.all")} ({formatNumberToLocale(entry.count.toString())})
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      ) : (
        <Pressable
          onPress={handleCompletePress}
          className="bg-success rounded-lg px-4 h-[56px] items-center justify-center">
          <HStack space="xs" className="items-center gap-1">
            <Icon as={Check} size="sm" className="text-background" />
            <Text className="text-background text-sm font-semibold">{t("common.complete")}</Text>
          </HStack>
        </Pressable>
      )}

      {/* Delete Button */}
      <Pressable
        onPress={handleDeletePress}
        className="bg-error rounded-lg px-4 h-[56px] items-center justify-center">
        <HStack space="xs" className="items-center gap-1">
          <Icon as={Trash2} size="sm" className="text-background" />
          <Text className="text-background text-sm font-semibold">{t("common.delete")}</Text>
        </HStack>
      </Pressable>
    </Animated.View>
  );
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);
  const isRTL = I18nManager.isRTL;

  const handleComplete = () => {
    onComplete(entry.id);
  };

  const handleCompleteAll = () => {
    onCompleteAll();
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

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isRTL ? undefined : renderActions}
      renderLeftActions={isRTL ? renderActions : undefined}
      overshootRight={!isRTL}
      overshootLeft={isRTL}
      friction={2}
      rightThreshold={isRTL ? undefined : SWIPE_THRESHOLD}
      leftThreshold={isRTL ? SWIPE_THRESHOLD : undefined}
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
