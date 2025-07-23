import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Components
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button, ButtonText } from "@/components/ui/button";

import AthkarCard from "@/components/athkar/AthkarCard";

// Store
import { useAthkarStore } from "@/stores/athkar";

// Types
import type { AthkarType } from "@/types/athkar";

// Icons
import { RotateCcw, Flame } from "lucide-react-native";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

type Props = {
  type: AthkarType;
};

const AthkarList = ({ type }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    athkarList,
    currentProgress,
    streak,
    settings,
    initializeSession,
    setCurrentAthkarIndex,
    resetProgress,
  } = useAthkarStore();

  // Filter athkar by type(Morning/Evening ALL for both)
  const filteredAthkar = athkarList
    .filter((athkar) => athkar.type === type || athkar.type === ATHKAR_TYPE.ALL)
    .sort((a, b) => a.order - b.order);

  // Initialize session if not already initialized for this type
  const hasSessionForType = currentProgress.some((p) => p.athkarId.includes(`-${type}`));
  if (!hasSessionForType && filteredAthkar.length > 0) {
    initializeSession(type as Exclude<AthkarType, "all">);
    return null;
  }

  const handleFocusMode = (index: number) => {
    setCurrentAthkarIndex(index);
    router.push("/athkar-focus");
  };

  // Calculate overall progress for streak
  const totalAthkar = filteredAthkar.length;
  const completedAthkar = currentProgress.filter(
    (p) => p.completed && p.athkarId.includes(`-${type}`)
  ).length;
  const overallProgress = totalAthkar > 0 ? (completedAthkar / totalAthkar) * 100 : 0;

  // Get actual streak data from store
  const streakDays = streak.currentStreak;

  return (
    <VStack space="md">
      {/* Streak Card */}
      {settings.showStreak && (
        <Card className="p-4 bg-background-secondary dark:bg-background-tertiary">
          <HStack className="justify-between items-center">
            <VStack space="sm" className="flex-1">
              <HStack space="sm" className="items-center">
                <Flame size={20} className="text-accent-warning" />
                <Text className="text-lg font-semibold text-typography">
                  {t("athkar.dailyStreak")}
                </Text>
              </HStack>
              <Text className="text-sm text-typography-secondary">
                {t("athkar.todayCompletion")}
              </Text>
              <Progress
                value={overallProgress}
                className="h-3 bg-background-tertiary dark:bg-background mt-2">
                <ProgressFilledTrack className="bg-accent-warning" />
              </Progress>
            </VStack>
            <VStack className="items-center justify-center">
              <Text className="text-3xl font-bold text-accent-warning">{streakDays}</Text>
              <Text className="text-sm text-typography-secondary">{t("athkar.days")}</Text>
            </VStack>
          </HStack>
          <Text className="text-xs text-typography-secondary mt-2 text-right">
            {Math.round(overallProgress)}%
          </Text>
        </Card>
      )}

      {/* Athkar Cards */}
      {filteredAthkar.map((athkar, index) => {
        const progress = currentProgress.find((p) => p.athkarId === `${athkar.id}-${type}`);
        const currentCount = progress?.currentCount || 0;
        const isCompleted = progress?.completed || false;

        return (
          <AthkarCard
            key={athkar.id}
            athkar={athkar}
            progress={{ current: currentCount, total: athkar.count, completed: isCompleted }}
            onFocusMode={() => handleFocusMode(index)}
          />
        );
      })}

      {/* Reset Button for Testing */}
      {__DEV__ && (
        <Button
          size="md"
          variant="outline"
          onPress={() => resetProgress()}
          className="mt-6 border-accent-danger">
          <RotateCcw size={20} className="mr-2 text-accent-danger" />
          <ButtonText className="text-accent-danger">{t("common.reset")}</ButtonText>
        </Button>
      )}
    </VStack>
  );
};

export default AthkarList;
