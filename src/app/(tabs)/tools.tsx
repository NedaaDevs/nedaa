import { useTranslation } from "react-i18next";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlarmClock,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  Compass,
  Headphones,
  Settings,
} from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { Tile } from "@/components/ui/tile";
import { VStack } from "@/components/ui/vstack";
import KaabaIcon from "@/components/umrah/icons/KaabaIcon";
import { UmrahContinue } from "@/components/umrah/UmrahContinue";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useAlarmSupported } from "@/hooks/useAlarmSupported";
import { useHaptic } from "@/hooks/useHaptic";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { localizedSurahName } from "@/utils/surahName";

type ToolItem = { id: string; titleKey: string; icon: React.ComponentType<any>; route: Href };

// Self-contained utilities: open, do one thing, leave. Anything with ongoing
// state lives in the Continue card or the rows below instead.
const TOOLS: readonly ToolItem[] = [
  {
    id: "compass",
    titleKey: BACK_DESTINATION.COMPASS.title,
    icon: Compass,
    route: BACK_DESTINATION.COMPASS.href,
  },
  {
    id: "hijri-calendar",
    titleKey: BACK_DESTINATION.HIJRI_CALENDAR.title,
    icon: CalendarHeart,
    route: BACK_DESTINATION.HIJRI_CALENDAR.href,
  },
  {
    id: "hijri-converter",
    titleKey: BACK_DESTINATION.HIJRI_CONVERTER.title,
    icon: CalendarRange,
    route: BACK_DESTINATION.HIJRI_CONVERTER.href,
  },
  // The occasions are marked on the Hijri calendar, so this tile opens it.
  {
    id: "important-days",
    titleKey: "importantDays.title",
    icon: CalendarDays,
    route: BACK_DESTINATION.HIJRI_CALENDAR.href,
  },
  {
    id: "qada",
    titleKey: "tools.qada.title",
    icon: CalendarCheck,
    route: BACK_DESTINATION.QADA.href,
  },
  {
    id: "umrah-guide",
    titleKey: "tools.umrahGuide.title",
    icon: KaabaIcon,
    route: BACK_DESTINATION.UMRAH.href,
  },
];

export default function ToolsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const alarmSupported = useAlarmSupported();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();

  const { city, country } = useLocationStore((state) => state.localizedLocation);
  const { fajr, friday } = useAlarmSettingsStore();
  const playerState = useQuranAudioStore((s) => s.playerState);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);

  const open = async (route: Href) => {
    await selectionHaptic();
    router.push(route);
  };

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
    // The sky runs under both bars; the content scrolls clear of the tab bar.
    <SkyBackground>
      <SkyScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: tabBarInset }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("tools.title")}
            subtitle={city && country ? t("tools.place", { city, country }) : city}
          />
        </SkyOccluder>

        <SkyOccluder>
          <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$5" gap="$5">
            <UmrahContinue />

            <Section title={t("tools.sections.utilities")}>
              <Grid columns={2} gap="$2">
                {TOOLS.map((tool) => (
                  <Grid.Item key={tool.id}>
                    <Tile
                      icon={tool.icon}
                      label={t(tool.titleKey)}
                      onPress={() => open(tool.route)}
                    />
                  </Grid.Item>
                ))}
              </Grid>
            </Section>

            {/* Rows, because they carry live state a tile can't show. */}
            <Section title={t("tools.sections.remindersAudio")}>
              <VStack gap="$2">
                {alarmSupported && (
                  <ListRow
                    icon={AlarmClock}
                    title={t("tools.alarm.title")}
                    status={alarmStatus}
                    onPress={() => open(BACK_DESTINATION.SETTINGS_ALARM.href)}
                  />
                )}
                <ListRow
                  icon={Headphones}
                  title={t("tools.quranListen.title")}
                  status={listenStatus}
                  onPress={() => open(BACK_DESTINATION.QURAN_LISTEN.href)}
                />
              </VStack>
            </Section>

            {/* Set apart by a rule: the way into everything the app can be set to. */}
            <Box paddingTop="$4" borderTopWidth={1} borderColor="$border">
              <ListRow
                icon={Settings}
                title={t("settings.title")}
                status={t("tools.settings.status")}
                onPress={() => open(BACK_DESTINATION.SETTINGS.href)}
              />
            </Box>
          </VStack>
        </SkyOccluder>
      </SkyScrollView>
    </SkyBackground>
  );
}
