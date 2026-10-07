import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CHALLENGE_DIFFICULTY, CHALLENGE_TYPE } from "expo-alarm";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Select } from "@/components/ui/select";

import {
  ChallengeConfig,
  ChallengeType,
  ChallengeDifficulty,
  ChallengeCount,
  CHALLENGE_COUNTS,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_TYPES,
} from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: ChallengeConfig;
  onChange: (config: ChallengeConfig) => void;
};

const CHALLENGE_TYPE_LABEL: Record<ChallengeType, string> = {
  [CHALLENGE_TYPE.NONE]: "alarm.challenge.none",
  [CHALLENGE_TYPE.TAP]: "alarm.challenge.tap",
  [CHALLENGE_TYPE.MATH]: "alarm.challenge.math",
  [CHALLENGE_TYPE.DHIKR]: "alarm.challenge.dhikr",
};

const CHALLENGE_DIFFICULTY_LABEL: Record<ChallengeDifficulty, string> = {
  [CHALLENGE_DIFFICULTY.EASY]: "alarm.challenge.easy",
  [CHALLENGE_DIFFICULTY.MEDIUM]: "alarm.challenge.medium",
  [CHALLENGE_DIFFICULTY.HARD]: "alarm.challenge.hard",
};

const ChallengePicker: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const handleTypeChange = (type: string) => {
    hapticSelection();
    onChange({ ...value, type: type as ChallengeType });
  };

  const handleDifficultyChange = (difficulty: string) => {
    hapticSelection();
    onChange({ ...value, difficulty: difficulty as ChallengeDifficulty });
  };

  const handleCountChange = (count: string) => {
    hapticSelection();
    onChange({ ...value, count: parseInt(count, 10) as ChallengeCount });
  };

  const typeItems = useMemo(
    () => CHALLENGE_TYPES.map((value) => ({ label: t(CHALLENGE_TYPE_LABEL[value]), value })),
    [t]
  );

  const difficultyItems = useMemo(
    () =>
      CHALLENGE_DIFFICULTIES.map((value) => ({
        label: t(CHALLENGE_DIFFICULTY_LABEL[value]),
        value,
      })),
    [t]
  );

  const countItems = useMemo(
    () => CHALLENGE_COUNTS.map((c) => ({ label: String(c), value: String(c) })),
    []
  );

  return (
    <VStack gap="$2">
      <VStack gap="$0.5">
        <Text size="sm" color="$typographySecondary">
          {t("alarm.challenge.type")}
        </Text>
        <Select
          selectedValue={value.type}
          onValueChange={handleTypeChange}
          items={typeItems}
          placeholder={t("alarm.challenge.type")}
        />
      </VStack>

      {value.type !== CHALLENGE_TYPE.NONE && (
        <>
          <VStack gap="$0.5">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.challenge.difficulty")}
            </Text>
            <Select
              selectedValue={value.difficulty}
              onValueChange={handleDifficultyChange}
              items={difficultyItems}
              placeholder={t("alarm.challenge.difficulty")}
            />
          </VStack>

          <VStack gap="$0.5">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.challenge.count")}
            </Text>
            <Select
              selectedValue={String(value.count)}
              onValueChange={handleCountChange}
              items={countItems}
              placeholder={t("alarm.challenge.count")}
            />
          </VStack>
        </>
      )}
    </VStack>
  );
};

export default ChallengePicker;
