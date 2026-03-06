import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import JourneyTimeline from "@/components/umrah/JourneyTimeline";

import { RotateCcw, Calendar, Clock } from "lucide-react-native";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";
import { UMRAH_STAGES } from "@/constants/UmrahGuide";

const formatDuration = (minutes: number, t: (key: string) => string): string => {
  if (minutes < 60) return `${minutes} ${t("umrah.history.min")}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0
    ? `${h} ${t("umrah.history.hr")} ${m} ${t("umrah.history.min")}`
    : `${h} ${t("umrah.history.hr")}`;
};

export default function UmrahOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const { activeProgress, history, startUmrah, resetProgress } = useUmrahGuideStore();

  const handleStagePress = async (stageIndex: number) => {
    await selectionHaptic();
    if (!activeProgress) {
      startUmrah();
    }
    router.push({ pathname: "/umrah/step", params: { stageIndex: String(stageIndex) } });
  };

  const handleStart = async () => {
    await selectionHaptic();
    startUmrah();
    router.push({ pathname: "/umrah/step", params: { stageIndex: "0" } });
  };

  const handleContinue = async () => {
    if (!activeProgress) return;
    await selectionHaptic();
    router.push({
      pathname: "/umrah/step",
      params: { stageIndex: String(activeProgress.currentStageIndex) },
    });
  };

  const handleReset = async () => {
    await selectionHaptic();
    resetProgress();
  };

  return (
    <Background>
      <TopBar title="umrah.title" backOnClick />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: activeProgress ? 80 : 100 }}>
        <JourneyTimeline onStagePress={handleStagePress} />

        {activeProgress && (
          <Box paddingHorizontal="$4" paddingTop="$4">
            <Pressable
              onPress={handleReset}
              flexDirection="row"
              alignItems="center"
              gap="$2"
              padding="$2"
              accessibilityRole="button"
              accessibilityLabel={t("umrah.resetProgress")}>
              <Icon as={RotateCcw} size="sm" color="$typographySecondary" />
              <Text size="sm" color="$typographySecondary">
                {t("umrah.resetProgress")}
              </Text>
            </Pressable>
          </Box>
        )}

        {history.length > 0 && (
          <VStack paddingHorizontal="$4" paddingTop="$6" gap="$3">
            <Text size="md" fontWeight="600" color="$typography">
              {t("umrah.history.title")}
            </Text>
            {history.map((record) => (
              <Box
                key={record.id}
                padding="$3"
                borderRadius="$3"
                backgroundColor="$backgroundSecondary">
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack alignItems="center" gap="$2">
                    <Icon as={Calendar} size="sm" color="$typographySecondary" />
                    <Text size="sm" color="$typography">
                      {record.hijriDate}
                    </Text>
                  </HStack>
                  <HStack alignItems="center" gap="$2">
                    <Icon as={Clock} size="sm" color="$typographySecondary" />
                    <Text size="xs" color="$typographySecondary">
                      {formatDuration(record.durationMinutes, t)}
                    </Text>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        paddingHorizontal="$4"
        paddingVertical="$3"
        paddingBottom="$6"
        backgroundColor="$backgroundElevated">
        {activeProgress ? (
          <HStack gap="$3">
            <Button
              flex={1}
              size="lg"
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel={t("umrah.continue")}>
              <Button.Text>
                {t("umrah.continue")} — {t(UMRAH_STAGES[activeProgress.currentStageIndex].titleKey)}
              </Button.Text>
            </Button>
          </HStack>
        ) : (
          <Button
            size="lg"
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={t("umrah.startUmrah")}>
            <Button.Text>{t("umrah.startUmrah")}</Button.Text>
          </Button>
        )}
      </Box>
    </Background>
  );
}
