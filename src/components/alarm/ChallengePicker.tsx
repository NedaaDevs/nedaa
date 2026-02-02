import { FC } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";

import { ChevronDown } from "lucide-react-native";

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

  return (
    <VStack space="md">
      <Text className="text-sm font-medium text-typography">{t("alarm.settings.challenge")}</Text>

      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography-secondary">{t("alarm.challenge.type")}</Text>
        <Select
          initialLabel={t(CHALLENGE_TYPES.find((c) => c.value === value.type)?.label || "")}
          selectedValue={value.type}
          onValueChange={handleTypeChange}>
          <SelectTrigger
            variant="outline"
            size="md"
            className="w-32 h-10 rounded-lg bg-background-primary">
            <SelectInput className="text-left !text-typography font-medium text-sm" />
            <SelectIcon className="mr-2" as={ChevronDown} />
          </SelectTrigger>

          <SelectPortal>
            <SelectBackdrop />
            <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>

              <SelectScrollView className="px-2 pt-1 pb-4">
                {CHALLENGE_TYPES.map((option) => (
                  <SelectItem
                    key={option.value}
                    label={t(option.label)}
                    value={option.value}
                    className={`px-4 py-3 mb-2 rounded-lg ${
                      value.type === option.value ? "bg-surface-active" : "bg-background-primary"
                    }`}
                  />
                ))}
              </SelectScrollView>
            </SelectContent>
          </SelectPortal>
        </Select>
      </HStack>

      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography-secondary">{t("alarm.challenge.difficulty")}</Text>
        <Select
          initialLabel={t(
            CHALLENGE_DIFFICULTIES.find((d) => d.value === value.difficulty)?.label || ""
          )}
          selectedValue={value.difficulty}
          onValueChange={handleDifficultyChange}>
          <SelectTrigger
            variant="outline"
            size="md"
            className="w-32 h-10 rounded-lg bg-background-primary">
            <SelectInput className="text-left !text-typography font-medium text-sm" />
            <SelectIcon className="mr-2" as={ChevronDown} />
          </SelectTrigger>

          <SelectPortal>
            <SelectBackdrop />
            <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>

              <SelectScrollView className="px-2 pt-1 pb-4">
                {CHALLENGE_DIFFICULTIES.map((option) => (
                  <SelectItem
                    key={option.value}
                    label={t(option.label)}
                    value={option.value}
                    className={`px-4 py-3 mb-2 rounded-lg ${
                      value.difficulty === option.value
                        ? "bg-surface-active"
                        : "bg-background-primary"
                    }`}
                  />
                ))}
              </SelectScrollView>
            </SelectContent>
          </SelectPortal>
        </Select>
      </HStack>

      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography-secondary">{t("alarm.challenge.count")}</Text>
        <Select
          initialLabel={String(value.count)}
          selectedValue={String(value.count)}
          onValueChange={handleCountChange}>
          <SelectTrigger
            variant="outline"
            size="md"
            className="w-32 h-10 rounded-lg bg-background-primary">
            <SelectInput className="text-left !text-typography font-medium text-sm" />
            <SelectIcon className="mr-2" as={ChevronDown} />
          </SelectTrigger>

          <SelectPortal>
            <SelectBackdrop />
            <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>

              <SelectScrollView className="px-2 pt-1 pb-4 max-h-[40vh]">
                {CHALLENGE_COUNTS.map((count) => (
                  <SelectItem
                    key={count}
                    label={String(count)}
                    value={String(count)}
                    className={`px-4 py-3 mb-2 rounded-lg ${
                      value.count === count ? "bg-surface-active" : "bg-background-primary"
                    }`}
                  />
                ))}
              </SelectScrollView>
            </SelectContent>
          </SelectPortal>
        </Select>
      </HStack>
    </VStack>
  );
};

export default ChallengePicker;
