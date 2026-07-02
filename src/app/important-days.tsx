import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { CalendarDays } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import TopBar from "@/components/TopBar";

import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { upcomingImportantDays } from "@/utils/importantDays";
import { useImportantDayFormat } from "@/hooks/useImportantDayFormat";
import { formatNumberToLocale } from "@/utils/number";

const ImportantDaysScreen = () => {
  const { t } = useTranslation();
  const hijriDaysOffset = useAppStore((s) => s.hijriDaysOffset);
  const { locationDetails } = useLocationStore();
  const timezone = locationDetails.timezone;
  const { hijriLabel, expectedLabel, remainingLabel, daysUnit } = useImportantDayFormat();

  const days = useMemo(
    () => upcomingImportantDays({ timezone, hijriDaysOffset }),
    [timezone, hijriDaysOffset]
  );

  const [closest, ...rest] = days;

  return (
    <Background>
      <TopBar title="importantDays.title" backOnClick />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <VStack paddingHorizontal="$4" paddingTop="$2" gap="$3">
          {/* Hero: the closest occasion */}
          {closest && (
            <Box
              backgroundColor="$backgroundSecondary"
              borderRadius="$6"
              padding="$4"
              accessibilityLabel={`${t(closest.i18nKey)}, ${remainingLabel(closest.daysRemaining)}, ${hijriLabel(closest)}, ${expectedLabel(closest.expectedGregorian)}`}>
              <HStack justifyContent="space-between" alignItems="center">
                <HStack alignItems="center" gap="$3" flexShrink={1} marginEnd="$3">
                  <Box
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor="$backgroundInteractive"
                    alignItems="center"
                    justifyContent="center">
                    <Icon as={CalendarDays} size="lg" color="$accentPrimary" />
                  </Box>
                  <VStack gap="$0.5" flexShrink={1}>
                    <Text size="lg" fontWeight="700" color="$typography">
                      {t(closest.i18nKey)}
                    </Text>
                    <Text size="sm" color="$typographySecondary">
                      {hijriLabel(closest)}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {expectedLabel(closest.expectedGregorian)}
                    </Text>
                  </VStack>
                </HStack>
                <VStack alignItems="center" minWidth={64}>
                  {closest.daysRemaining <= 1 ? (
                    <Text size="xl" fontWeight="800" color="$accentPrimary">
                      {remainingLabel(closest.daysRemaining)}
                    </Text>
                  ) : (
                    <>
                      <Text size="3xl" fontWeight="800" color="$accentPrimary">
                        {formatNumberToLocale(String(closest.daysRemaining))}
                      </Text>
                      <Text size="xs" color="$typographySecondary">
                        {daysUnit(closest.daysRemaining)}
                      </Text>
                    </>
                  )}
                </VStack>
              </HStack>
            </Box>
          )}

          {/* The rest: compact rows with quiet countdown pills */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" paddingHorizontal="$4">
            {rest.map((day, i) => (
              <HStack
                key={day.id}
                justifyContent="space-between"
                alignItems="center"
                paddingVertical="$3"
                minHeight={56}
                borderTopWidth={i === 0 ? 0 : 1}
                borderTopColor="$backgroundMuted"
                accessibilityLabel={`${t(day.i18nKey)}, ${remainingLabel(day.daysRemaining)}, ${hijriLabel(day)}`}>
                <VStack flexShrink={1} marginEnd="$3" gap="$0.5">
                  <Text size="md" fontWeight="600" color="$typography">
                    {t(day.i18nKey)}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {`${hijriLabel(day)} · ${expectedLabel(day.expectedGregorian)}`}
                  </Text>
                </VStack>
                <Box
                  backgroundColor="$backgroundMuted"
                  borderRadius="$4"
                  paddingHorizontal="$3"
                  paddingVertical="$1.5">
                  <Text size="sm" fontWeight="600" color="$accentPrimary">
                    {remainingLabel(day.daysRemaining)}
                  </Text>
                </Box>
              </HStack>
            ))}
          </Box>

          <Text size="xs" color="$typographySecondary" textAlign="center" paddingVertical="$2">
            {t("importantDays.disclaimer")}
          </Text>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default ImportantDaysScreen;
