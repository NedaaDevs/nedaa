import { FC, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

import { ChallengeDifficulty, CHALLENGE_DIFFICULTY_CONFIG } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
};

const TapChallenge: FC<Props> = ({ difficulty, onComplete }) => {
  const { t } = useTranslation();
  const hapticLight = useHaptic("light");
  const hapticSuccess = useHaptic("success");
  const completedRef = useRef(false);

  const requiredTaps = CHALLENGE_DIFFICULTY_CONFIG.tap[difficulty].taps;
  const [tapCount, setTapCount] = useState(0);

  const remainingTaps = requiredTaps - tapCount;

  useEffect(() => {
    if (tapCount >= requiredTaps && !completedRef.current) {
      completedRef.current = true;
      hapticSuccess();
      onComplete();
    }
  }, [tapCount, requiredTaps, onComplete, hapticSuccess]);

  const handleTap = () => {
    hapticLight();
    setTapCount((prev) => prev + 1);
  };

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Text size="5xl" bold color="$typography">
        {remainingTaps}
      </Text>
      <Text size="sm" color="$typographySecondary">
        {t("alarm.challenge.tapsRemaining")}
      </Text>

      <Button size="xl" width="100%" marginTop="$4" onPress={handleTap}>
        <Button.Text size="lg">
          {remainingTaps > 0 ? t("alarm.challenge.tapToDismiss") : t("alarm.challenge.done")}
        </Button.Text>
      </Button>
    </VStack>
  );
};

export default TapChallenge;
