import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Check, AlertCircle } from "lucide-react-native";

import type { UpdateState, UpdateStep } from "@/hooks/useLocationUpdate";

type Props = {
  state: UpdateState;
  onRetry: () => void;
};

const STEP_KEYS: Record<UpdateStep, string> = {
  location: "location.update.step.location",
  prayerTimes: "location.update.step.prayerTimes",
  notifications: "location.update.step.notifications",
  alarms: "location.update.step.alarms",
  done: "location.update.step.done",
};

const LocationUpdateProgress = ({ state, onRetry }: Props) => {
  const { t } = useTranslation();

  if (!state.isUpdating && !state.currentStep && !state.error) {
    return null;
  }

  if (state.error) {
    return (
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t("location.update.error")}
        minHeight={44}>
        <HStack alignItems="center" gap="$2" paddingVertical="$2" paddingHorizontal="$3">
          <Icon as={AlertCircle} size="sm" color="$error" />
          <Text size="sm" color="$error">
            {t("location.update.error")}
          </Text>
        </HStack>
      </Pressable>
    );
  }

  if (!state.currentStep) return null;

  const stepText = t(STEP_KEYS[state.currentStep]);
  const isDone = state.currentStep === "done";

  return (
    <HStack
      alignItems="center"
      gap="$2"
      paddingVertical="$2"
      paddingHorizontal="$3"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t("a11y.location.updateProgress", { step: stepText })}>
      {isDone ? <Icon as={Check} size="sm" color="$success" /> : <ActivityIndicator size="small" />}
      <Text size="sm" color={isDone ? "$success" : "$typographySecondary"}>
        {stepText}
      </Text>
    </HStack>
  );
};

export default LocationUpdateProgress;
