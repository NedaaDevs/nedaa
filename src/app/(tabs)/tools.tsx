import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import TopBar from "@/components/TopBar";

import {
  AlarmClock,
  Compass,
  CalendarRange,
  CalendarCheck,
  CalendarDays,
  Headphones,
  ChevronRight,
  ChevronLeft,
} from "lucide-react-native";
import KaabaIcon from "@/components/umrah/icons/KaabaIcon";
import ProgressRing from "@/components/umrah/ProgressRing";

import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { UMRAH_STAGES } from "@/constants/UmrahGuide";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";
import { useRTL } from "@/contexts/RTLContext";

type ToolItem = {
  id: string;
  titleKey: string;
  subtitleKey: string;
  icon: React.ComponentType<any>;
  route: string;
};

// Self-contained utilities: open, do one thing, leave. Anything with ongoing
// state lives in the Continue card or the rows below instead.
const UTILITIES: ToolItem[] = [
  {
    id: "umrah-guide",
    titleKey: "tools.umrahGuide.title",
    subtitleKey: "tools.umrahGuide.subtitle",
    icon: KaabaIcon,
    route: "/umrah",
  },
  {
    id: "hijri-converter",
    titleKey: "tools.hijriConverter.title",
    subtitleKey: "tools.hijriConverter.subtitle",
    icon: CalendarRange,
    route: "/hijri-converter",
  },
  {
    id: "important-days",
    titleKey: "importantDays.title",
    subtitleKey: "importantDays.subtitle",
    icon: CalendarDays,
    route: "/important-days",
  },
  {
    id: "qada",
    titleKey: "tools.qada.title",
    subtitleKey: "tools.qada.subtitle",
    icon: CalendarCheck,
    route: "/(tabs)/qada",
  },
  {
    id: "compass",
    titleKey: "tools.compass.title",
    subtitleKey: "tools.compass.subtitle",
    icon: Compass,
    route: "/(tabs)/compass",
  },
];

// Matches the section-label treatment used in Other Reminders and Custom Athkar.
// No letter-spacing: positive tracking separates the joins in Arabic script.
const SectionHeader = ({ label }: { label: string }) => (
  <Text
    size="sm"
    fontWeight="600"
    color="$typographySecondary"
    textTransform="uppercase"
    accessibilityRole="header">
    {label}
  </Text>
);

export default function ToolsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const { isRTL } = useRTL();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const activeProgress = useUmrahGuideStore((state) => state.activeProgress);
  // Called inside the selector so it re-runs on every store change.
  const umrahProgress = useUmrahGuideStore((state) => state.getProgressFraction());
  const { fajr, friday } = useAlarmSettingsStore();
  const playerState = useQuranAudioStore((s) => s.playerState);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);

  const handleToolPress = async (route: string) => {
    await selectionHaptic();
    router.push(route as any);
  };

  const currentStage = activeProgress ? UMRAH_STAGES[activeProgress.currentStageIndex] : null;
  const continueLabel = currentStage
    ? t("tools.continue.stepOf", {
        stage: t(currentStage.titleKey),
        current: formatNumberToLocale(String((activeProgress?.currentStepIndex ?? 0) + 1)),
        total: formatNumberToLocale(String(currentStage.steps.length)),
      })
    : "";

  // Only two alarm types exist, so naming them is more useful than a count.
  const enabledAlarms = [
    fajr.enabled ? t("prayerTimes.fajr") : null,
    friday.enabled ? t("prayerTimes.jumuah") : null,
  ].filter(Boolean);
  const alarmStatus = enabledAlarms.length ? enabledAlarms.join(" · ") : t("tools.alarm.statusOff");

  const isListening = currentSurah != null && playerState !== QURAN_PLAYER_STATE.IDLE;
  const listenStatus = isListening
    ? t("tools.quranListen.nowPlaying", { surah: localizedSurahName(currentSurah) })
    : t("tools.quranListen.subtitle");

  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
        <TopBar title="tools.title" />

        <VStack paddingHorizontal="$4" paddingTop="$2" gap="$5">
          {/* Continue — present only while a journey is in progress. */}
          {activeProgress && currentStage && (
            <VStack gap="$2">
              <SectionHeader label={t("tools.sections.continue")} />
              <Card.Pressable
                onPress={() => handleToolPress("/umrah")}
                flexDirection="row"
                alignItems="center"
                gap="$3"
                accessibilityRole="button"
                accessibilityLabel={`${t("tools.umrahGuide.title")}, ${continueLabel}`}
                accessibilityHint={t("a11y.tools.continueHint")}>
                <ProgressRing progress={umrahProgress} size="md" />
                <VStack flex={1} gap="$0.5">
                  <Text size="md" fontWeight="600" color="$typography">
                    {t("tools.umrahGuide.title")}
                  </Text>
                  <Text size="xs" color="$typographySecondary" numberOfLines={1}>
                    {continueLabel}
                  </Text>
                </VStack>
                <Icon as={ChevronIcon} size="sm" color="$accentPrimary" />
              </Card.Pressable>
            </VStack>
          )}

          {/* Utilities — content-height tiles so short labels don't strand. */}
          <VStack gap="$2">
            <SectionHeader label={t("tools.sections.utilities")} />
            <HStack flexWrap="wrap" justifyContent="space-between" rowGap="$3">
              {UTILITIES.map((tool) => (
                <Card.Pressable
                  key={tool.id}
                  width="48%"
                  minHeight={118}
                  gap="$3"
                  onPress={() => handleToolPress(tool.route)}
                  accessibilityRole="button"
                  accessibilityLabel={t(tool.titleKey)}
                  accessibilityHint={t(tool.subtitleKey)}>
                  <Box
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor="$backgroundInteractive"
                    alignItems="center"
                    justifyContent="center">
                    <Icon as={tool.icon} size="lg" color="$typographySecondary" />
                  </Box>
                  <VStack gap="$0.5">
                    <Text size="md" fontWeight="600" color="$typography">
                      {t(tool.titleKey)}
                    </Text>
                    <Text size="xs" color="$typographySecondary" numberOfLines={2}>
                      {t(tool.subtitleKey)}
                    </Text>
                  </VStack>
                </Card.Pressable>
              ))}
            </HStack>
          </VStack>

          {/* Reminders & audio — rows, because they carry live state a tile can't show. */}
          <VStack gap="$2">
            <SectionHeader label={t("tools.sections.remindersAudio")} />
            <VStack gap="$3">
              <ToolRow
                icon={AlarmClock}
                title={t("tools.alarm.title")}
                status={alarmStatus}
                chevron={ChevronIcon}
                onPress={() => handleToolPress("/settings/alarm")}
              />
              <ToolRow
                icon={Headphones}
                title={t("tools.quranListen.title")}
                status={listenStatus}
                chevron={ChevronIcon}
                onPress={() => handleToolPress("/quran-listen")}
              />
            </VStack>
          </VStack>
        </VStack>
      </ScrollView>
    </Background>
  );
}

type ToolRowProps = {
  icon: React.ComponentType<any>;
  title: string;
  status: string;
  chevron: React.ComponentType<any>;
  onPress: () => void;
};

const ToolRow = ({ icon, title, status, chevron, onPress }: ToolRowProps) => (
  <Card.Pressable
    onPress={onPress}
    flexDirection="row"
    alignItems="center"
    gap="$3"
    accessibilityRole="button"
    accessibilityLabel={`${title}, ${status}`}>
    <Box
      width={44}
      height={44}
      borderRadius="$3"
      backgroundColor="$backgroundInteractive"
      alignItems="center"
      justifyContent="center">
      <Icon as={icon} size="lg" color="$typographySecondary" />
    </Box>
    <VStack flex={1} gap="$0.5">
      <Text size="md" fontWeight="600" color="$typography">
        {title}
      </Text>
      <Text size="xs" color="$typographySecondary" numberOfLines={1}>
        {status}
      </Text>
    </VStack>
    <Icon as={chevron} size="sm" color="$typographySecondary" />
  </Card.Pressable>
);
