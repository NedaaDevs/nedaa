import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { PermissionStatus } from "expo-notifications";
import { Bell } from "lucide-react-native";

import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useBusyRequest } from "@/components/onboarding/flow/useBusyRequest";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { SkyOccluder } from "@/components/ui/sky-background";
import { SoundPreview } from "@/components/ui/sound-preview";
import { Text } from "@/components/ui/text";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { DEFAULT_ATHAN_SOUND, SOUND_ASSETS } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { requestNotificationPermission } from "@/utils/notifications";

const log = AppLogger.create("notifications");

const ATHAN_SAMPLE = SOUND_ASSETS[DEFAULT_ATHAN_SOUND].previewSource;

/** Whether notifications were granted; a failed request counts as denied. */
const requestGranted = async () => {
  try {
    const { status } = await requestNotificationPermission();
    return status === PermissionStatus.GRANTED;
  } catch (error) {
    log.w("Onboarding", `request failed: ${errorText(error)}`);
    return false;
  }
};

/** Asks for notification permission beside the next prayer. */
export const NotificationsStep = ({
  onNext,
  setBusy,
  setPrimary,
  headingRef,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const { request } = useBusyRequest(setBusy);
  const deniedBody = t("onboarding.notifications.deniedBody");
  useIosAnnouncement(denied ? deniedBody : null);

  const allow = () =>
    request(() =>
      requestGranted().then((granted) => {
        if (granted) onNext();
        else setDenied(true);
      })
    );

  useStepPrimary(
    setPrimary,
    denied ? null : { label: t("onboarding.notifications.allowNotifications"), onPress: allow }
  );

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t("onboarding.notifications.question")}
      />
      <SkyOccluder>
        <OnboardingCard gap="$3">
          <HStack gap="$3" alignItems="center">
            <Icon as={Bell} size="lg" color="$accent" />
            <Text flex={1} size="sm" color="$fg">
              {t("onboarding.notifications.card")}
            </Text>
          </HStack>
          {/* Only iOS marks the athan time-sensitive, which asks to come
              through a Focus. */}
          {Platform.OS === PlatformType.IOS ? (
            <Text size="sm" color="$mutedSky">
              {t("onboarding.notifications.focusNote")}
            </Text>
          ) : null}
          <SoundPreview
            source={ATHAN_SAMPLE}
            playLabel={t("onboarding.notifications.hearAthan")}
            stopLabel={t("onboarding.notifications.stopAthan")}
            showLabel
          />
          {denied ? (
            <Text
              testID={ONBOARDING_PART.NOTIFICATIONS_DENIED}
              accessibilityLiveRegion="polite"
              size="sm"
              color="$mutedSky">
              {deniedBody}
            </Text>
          ) : null}
        </OnboardingCard>
      </SkyOccluder>
      <FocusCountdown />
    </StepBody>
  );
};
