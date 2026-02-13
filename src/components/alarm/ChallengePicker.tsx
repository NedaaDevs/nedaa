import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Select } from "@/components/ui/select";

import {
  ChallengeConfig,
  ChallengeType,
  ChallengeDifficulty,
  ChallengeCount,
  CHALLENGE_COUNTS,
} from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: ChallengeConfig;
  onChange: (config: ChallengeConfig) => void;
};

const CHALLENGE_TYPES: { value: ChallengeType; label: string }[] = [
  { value: "none", label: "alarm.challenge.none" },
  { value: "tap", label: "alarm.challenge.tap" },
  { value: "math", label: "alarm.challenge.math" },
];

const CHALLENGE_DIFFICULTIES: { value: ChallengeDifficulty; label: string }[] = [
  { value: "easy", label: "alarm.challenge.easy" },
  { value: "medium", label: "alarm.challenge.medium" },
  { value: "hard", label: "alarm.challenge.hard" },
];

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
    () => CHALLENGE_TYPES.map((c) => ({ label: t(c.label), value: c.value })),
    [t]
  );

  const difficultyItems = useMemo(
    () => CHALLENGE_DIFFICULTIES.map((d) => ({ label: t(d.label), value: d.value })),
    [t]
  );

  const countItems = useMemo(
    () => CHALLENGE_COUNTS.map((c) => ({ label: String(c), value: String(c) })),
    []
  );

  return (
    <VStack gap="$3">
      <Text size="sm" fontWeight="500" color="$typography">
        {t("alarm.settings.challenge")}
      </Text>

      <HStack justifyContent="space-between" alignItems="center">
        <Text size="sm" color="$typographySecondary" flex={1}>
          {t("alarm.challenge.type")}
        </Text>
        <Select
          selectedValue={value.type}
          onValueChange={handleTypeChange}
          items={typeItems}
          placeholder={t("alarm.challenge.type")}
        />
      </HStack>

      {value.type !== "none" && (
        <>
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary" flex={1}>
              {t("alarm.challenge.difficulty")}
            </Text>
            <Select
              selectedValue={value.difficulty}
              onValueChange={handleDifficultyChange}
              items={difficultyItems}
              placeholder={t("alarm.challenge.difficulty")}
            />
          </HStack>

          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary" flex={1}>
              {t("alarm.challenge.count")}
            </Text>
            <Select
              selectedValue={String(value.count)}
              onValueChange={handleCountChange}
              items={countItems}
              placeholder={t("alarm.challenge.count")}
            />
          </HStack>
        </>
      )}
    </VStack>
  );
};

export default ChallengePicker;
