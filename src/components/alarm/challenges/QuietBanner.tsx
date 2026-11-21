import { useEffect, useRef } from "react";
import { View, type ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { VolumeX } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { EMERGENCY_QUIET_PART } from "@/constants/EmergencyQuiet";
import { useClockTime } from "@/hooks/useClockTime";
import { focusOn } from "@/utils/accessibilityFocus";
import { deviceTimeZone } from "@/utils/date";

/** The running emergency quiet and the time the alarm rings again. */
const QuietBanner = ({ until }: { until: number }) => {
  const { t } = useTranslation();
  const time = useClockTime()(new Date(until), deviceTimeZone());
  const banner = useRef<ViewInstance>(null);

  // It replaces the confirm under the reader's focus, so focus moves to it.
  useEffect(() => focusOn(banner.current), []);

  return (
    <View
      ref={banner}
      testID={EMERGENCY_QUIET_PART.BANNER}
      accessible
      accessibilityLabel={t("alarm.quiet.banner", { time: time.spoken })}>
      <HStack
        minHeight="$12"
        paddingVertical="$2"
        paddingHorizontal="$4"
        gap="$stack"
        alignItems="center"
        borderRadius="$card"
        borderWidth={2.5}
        borderColor="$fg"
        backgroundColor="$surface">
        <Icon as={VolumeX} size="lg" color="$fg" />
        <Text flex={1} size="label" fontWeight="600" color="$fg">
          {t("alarm.quiet.banner", { time: time.shown })}
        </Text>
      </HStack>
    </View>
  );
};

type StatusProps = {
  quietUntil: number | null;
  /** The alarm rings again after its quiet. */
  used: boolean;
};

/** Says that the quiet was used as the alarm rings again. */
export const QuietStatus = ({ quietUntil, used }: StatusProps) => {
  const { t } = useTranslation();
  const message = quietUntil === null && used ? t("alarm.quiet.used") : null;

  return <SpokenStatus testID={EMERGENCY_QUIET_PART.BANNER_STATUS} message={message} />;
};

export default QuietBanner;
