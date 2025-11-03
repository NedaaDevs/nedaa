import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SharedValue } from "react-native-reanimated";
import { View } from "react-native";

// Components
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Check, Trash2, CalendarDays, CheckCheck } from "lucide-react-native";

// Types
import type { QadaHistory } from "@/services/qada-db";

// Utils
import { format } from "date-fns";

const ACTION_WIDTH = 75;

type Props = {
  entry: QadaHistory;
  onComplete: (id: number) => void;
  onCompleteAll: () => void;
  onDelete: (id: number) => void;
};

export const SwipeableEntry = ({ entry, onComplete, onCompleteAll, onDelete }: Props) => {
  const { t } = useTranslation();
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);

  const renderRightActions = (_progress: SharedValue<number>, _drag: SharedValue<number>) => {
    return (
      <View style={{ flexDirection: "row", height: 60 }}>
        <Pressable
          onPress={() => {
            onComplete(entry.id);
            swipeableRef.current?.close();
          }}
          className="w-[75px] h-[60px] bg-success justify-center items-center rounded-tl-xl rounded-bl-xl">
          <Icon as={Check} className="text-background" size="lg" />
          <Text className="text-background text-xs font-medium mt-1">{t("qada.complete")}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onCompleteAll();
            swipeableRef.current?.close();
          }}
          className="w-[75px] h-[60px] bg-primary justify-center items-center rounded-tr-xl rounded-br-xl">
          <Icon as={CheckCheck} className="text-background" size="lg" />
          <Text className="text-background text-xs font-medium mt-1">{t("qada.completeAll")}</Text>
        </Pressable>
      </View>
    );
  };

  const renderLeftActions = (_progress: SharedValue<number>, _drag: SharedValue<number>) => {
    return (
      <View style={{ flexDirection: "row", height: 60 }}>
        <Pressable
          onPress={() => {
            onDelete(entry.id);
            swipeableRef.current?.close();
          }}
          className="w-[75px] h-[60px] justify-center items-center bg-error rounded-xl ml-2">
          <Icon as={Trash2} className="text-background" size="lg" />
          <Text className="text-background text-xs font-medium mt-1">{t("qada.delete")}</Text>
        </Pressable>
      </View>
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
      rightThreshold={ACTION_WIDTH + 20}
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
                <Text className="text-xs text-typography-secondary text-left mt-1">
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
