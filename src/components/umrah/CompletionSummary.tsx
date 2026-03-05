import { useTranslation } from "react-i18next";
import { MotiView } from "moti";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Check, Calendar, Clock, Play, Flag } from "lucide-react-native";

import type { UmrahRecord } from "@/types/umrah";

type Props = {
  record: UmrahRecord;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const CompletionSummary = ({ record }: Props) => {
  const { t } = useTranslation();

  const stats = [
    { icon: Calendar, label: t("umrah.complete.date"), value: record.hijriDate },
    { icon: Calendar, label: t("umrah.complete.date"), value: record.gregorianDate },
    {
      icon: Clock,
      label: t("umrah.complete.duration"),
      value: formatDuration(record.durationMinutes),
    },
    { icon: Play, label: t("umrah.complete.started"), value: formatTime(record.startedAt) },
    { icon: Flag, label: t("umrah.complete.finished"), value: formatTime(record.completedAt) },
  ];

  return (
    <VStack alignItems="center" gap="$6" paddingHorizontal="$4">
      {/* Animated checkmark */}
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 10, delay: 200 }}>
        <Box
          width={80}
          height={80}
          borderRadius={40}
          backgroundColor="$accentPrimary"
          alignItems="center"
          justifyContent="center">
          <Icon as={Check} size="xl" color="white" />
        </Box>
      </MotiView>

      {/* Acceptance text */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 500 }}>
        <Text size="2xl" color="$typography" textAlign="center" lineHeight={40}>
          {t("umrah.complete.arabicAcceptance")}
        </Text>
        <Text size="md" color="$typographySecondary" textAlign="center" marginTop="$1">
          {t("umrah.complete.mayAllahAccept")}
        </Text>
      </MotiView>

      {/* Stats card */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 700 }}
        style={{ width: "100%" }}>
        <Box padding="$4" borderRadius="$4" backgroundColor="$backgroundSecondary" width="100%">
          <VStack gap="$3">
            {stats.map((stat, index) => (
              <HStack key={index} justifyContent="space-between" alignItems="center">
                <HStack gap="$2" alignItems="center">
                  <Icon as={stat.icon} size="sm" color="$typographySecondary" />
                  <Text size="sm" color="$typographySecondary">
                    {stat.label}
                  </Text>
                </HStack>
                <Text size="sm" fontWeight="600" color="$typography">
                  {stat.value}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </MotiView>
    </VStack>
  );
};

export default CompletionSummary;
