import { useState } from "react";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Theme } from "tamagui";
import { LinearGradient } from "expo-linear-gradient";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import StreakShareButton from "@/components/StreakShareButton";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Sun, Building2, CircleCheck } from "lucide-react-native";
import { ScheduledAlarmType } from "@/enums/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useAlarmStreakStore } from "@/stores/alarmStreak";

// Well-established morning adhkar, shown in Arabic across every locale with a
// localized translation below it. Invariant scripture, so it lives here rather
// than in the per-locale copy files.
const MORNING_DHIKR_AR = "اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور";

const COLOR_MAP: Record<string, string> = {
  "text-warning": "$warning",
  "text-success": "$success",
  "text-info": "$info",
};

const SUCCESS_CONTENT: Record<
  ScheduledAlarmType,
  {
    icon: React.ComponentType;
    titleKey: string;
    subtitleKey: string;
    colorClass: string;
  }
> = {
  [ScheduledAlarmType.FAJR]: {
    icon: Sun,
    titleKey: "alarm.complete.fajr.title",
    subtitleKey: "alarm.complete.fajr.subtitle",
    colorClass: "text-warning",
  },
  [ScheduledAlarmType.JUMMAH]: {
    icon: Building2,
    titleKey: "alarm.complete.friday.title",
    subtitleKey: "alarm.complete.friday.subtitle",
    colorClass: "text-success",
  },
  [ScheduledAlarmType.CUSTOM]: {
    icon: CircleCheck,
    titleKey: "alarm.complete.custom.title",
    subtitleKey: "alarm.complete.custom.subtitle",
    colorClass: "text-info",
  },
};

export default function AlarmCompleteScreen() {
  const { t } = useTranslation();
  const { alarmType } = useLocalSearchParams<{ alarmType: string }>();

  const type = (alarmType as ScheduledAlarmType) ?? ScheduledAlarmType.CUSTOM;
  const isFajr = type === ScheduledAlarmType.FAJR;
  const content = SUCCESS_CONTENT[type] ?? SUCCESS_CONTENT[ScheduledAlarmType.CUSTOM];
  const resolvedColor = COLOR_MAP[content.colorClass] ?? "$typography";

  const streak = useAlarmStreakStore((state) => state.streak);
  const showStreak = isFajr && streak >= 2;

  // Minutes until sunrise, resolved once on mount from today's timings via a
  // lazy initializer (not a render-time computation) since it reads the clock.
  const [sunriseMinutes] = useState<number | null>(() => {
    if (!isFajr) return null;
    const sunriseISO = usePrayerTimesStore.getState().todayTimings?.otherTimings?.sunrise;
    if (!sunriseISO) return null;
    const diffMs = new Date(sunriseISO).getTime() - Date.now();
    if (diffMs <= 0) return null;
    return Math.round(diffMs / 60000);
  });

  const handleGoHome = () => {
    router.replace("/");
  };

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Theme name="dark">
        <StatusBar style="light" />
        <Background>
          <LinearGradient
            colors={[
              "transparent",
              "transparent",
              "rgba(245, 200, 120, 0.16)",
              "rgba(245, 200, 120, 0.30)",
            ]}
            locations={[0, 0.55, 0.82, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <VStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$5">
            <Card padding="$8" width="100%" maxWidth={384} alignItems="center">
              <VStack gap="$4" alignItems="center" width="100%">
                <Icon as={content.icon} size="xl" color={resolvedColor} />

                <Text
                  size="2xl"
                  bold
                  color="$typography"
                  textAlign="center"
                  accessibilityRole="header">
                  {t(content.titleKey)}
                </Text>

                <Text textAlign="center" color="$typographySecondary">
                  {t(content.subtitleKey)}
                </Text>

                {showStreak && (
                  <HStack alignItems="center" gap="$2" marginTop="$1">
                    <Text textAlign="center" size="lg" fontWeight="600" color="$warning">
                      {t("alarm.complete.streak", { count: streak })}
                    </Text>
                    <StreakShareButton variant="fajr" count={streak} />
                  </HStack>
                )}

                {isFajr && sunriseMinutes != null && (
                  <Text textAlign="center" size="sm" color="$typographySecondary">
                    {t("alarm.complete.sunriseIn", { minutes: sunriseMinutes })}
                  </Text>
                )}

                {isFajr && (
                  <VStack
                    gap="$2"
                    alignItems="center"
                    width="100%"
                    marginTop="$2"
                    accessible
                    accessibilityLabel={t("alarm.complete.morningDhikr.translation")}>
                    <Text
                      fontSize={20}
                      lineHeight={34}
                      textAlign="center"
                      color="$typography"
                      style={{ fontFamily: "IBMPlexSans-Regular" }}>
                      {MORNING_DHIKR_AR}
                    </Text>
                    <Text
                      textAlign="center"
                      size="sm"
                      color="$typographySecondary"
                      fontStyle="italic">
                      {t("alarm.complete.morningDhikr.translation")}
                    </Text>
                  </VStack>
                )}

                <Text
                  textAlign="center"
                  size="lg"
                  fontWeight="500"
                  color="$success"
                  fontStyle="italic"
                  marginTop="$2">
                  {t("alarm.complete.encouragement")}
                </Text>

                <Button
                  size="lg"
                  width="100%"
                  marginTop="$4"
                  onPress={handleGoHome}
                  accessibilityLabel={t("a11y.goHome")}>
                  <Button.Text>{t("alarm.complete.goHome")}</Button.Text>
                </Button>
              </VStack>
            </Card>
          </VStack>
        </Background>
      </Theme>
    </>
  );
}
