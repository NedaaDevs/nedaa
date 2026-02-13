import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

import TapChallenge from "./TapChallenge";
import MathChallenge from "./MathChallenge";
import NoneChallenge from "./NoneChallenge";

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
    <VStack gap="$4" width="100%">
      {count > 1 && (
        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.challenge.progress")}
            </Text>
            <Badge size="sm" action="info">
              <Badge.Text>
                {completedCount}/{count}
              </Badge.Text>
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
      ) : type === "math" ? (
        <MathChallenge
          key={challengeKey}
          difficulty={difficulty}
          onComplete={handleChallengeComplete}
        />
      ) : (
        <NoneChallenge onComplete={handleChallengeComplete} />
      )}
    </VStack>
  );
};

export default ChallengeWrapper;
