import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

import TapChallenge from "./TapChallenge";
import MathChallenge from "./MathChallenge";

import { ChallengeConfig } from "@/types/alarm";

type Props = {
  config: ChallengeConfig;
  onAllComplete: () => void;
};

const ChallengeWrapper: FC<Props> = ({ config, onAllComplete }) => {
  const { t } = useTranslation();
  const [completedCount, setCompletedCount] = useState(0);
  const [challengeKey, setChallengeKey] = useState(0);

  const { type, difficulty, count } = config;
  const progress = (completedCount / count) * 100;

  const handleChallengeComplete = useCallback(() => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);

    if (newCount >= count) {
      onAllComplete();
    } else {
      setChallengeKey((prev) => prev + 1);
    }
  }, [completedCount, count, onAllComplete]);

  return (
    <VStack space="lg" className="w-full">
      {count > 1 && (
        <VStack space="sm">
          <HStack className="justify-between items-center">
            <Text className="text-sm text-typography-secondary">
              {t("alarm.challenge.progress")}
            </Text>
            <Badge size="sm" action="info">
              <BadgeText>
                {completedCount}/{count}
              </BadgeText>
            </Badge>
          </HStack>
          <Progress value={progress} size="sm">
            <ProgressFilledTrack />
          </Progress>
        </VStack>
      )}

      {type === "tap" ? (
        <TapChallenge
          key={challengeKey}
          difficulty={difficulty}
          onComplete={handleChallengeComplete}
        />
      ) : (
        <MathChallenge
          key={challengeKey}
          difficulty={difficulty}
          onComplete={handleChallengeComplete}
        />
      )}
    </VStack>
  );
};

export default ChallengeWrapper;
