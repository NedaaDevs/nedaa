import { useTranslation } from "react-i18next";
import { useRouter, type Href } from "expo-router";
import type { ParseKeys } from "i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Activity,
  BookText,
  Bug,
  CircleHelp,
  Eraser,
  HeartHandshake,
  Layers,
  ListChecks,
  MapPin,
  MapPinned,
  MessageSquareText,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react-native";

import { AboutBrand } from "@/components/about/AboutBrand";
import { PhoneZoneRow } from "@/components/about/PhoneZoneRow";
import { ReleaseNotesCard } from "@/components/about/ReleaseNotesCard";
import { VersionLine } from "@/components/about/VersionLine";
import type { IconProps } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { DEBUG_COPY, DEBUG_SCREEN, type DebugScreen } from "@/constants/DebugScreens";
import { SECTION_KIND } from "@/constants/Section";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useAppStore } from "@/stores/app";
import { useDebugModeStore } from "@/stores/debugMode";
import {
  clearCityCheckMemory,
  runCityCheckNow,
  showCityCheckMemory,
  showNamedCityChange,
  showUnnamedCityChange,
} from "@/utils/cityCheckDebug";

type AboutRow = {
  destination: BackDestination;
  summaryKey: ParseKeys;
  icon: IconProps["as"];
};

const NEDAA_ROWS: readonly AboutRow[] = [
  {
    destination: BACK_DESTINATION.SETTINGS_PRIVACY,
    summaryKey: "settings.about.privacySummary",
    icon: ShieldCheck,
  },
  {
    destination: BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS,
    summaryKey: "settings.about.acknowledgementsSummary",
    icon: HeartHandshake,
  },
];

const HELP_ROWS: readonly AboutRow[] = [
  {
    destination: BACK_DESTINATION.SETTINGS_HELP,
    summaryKey: "settings.about.helpSummary",
    icon: CircleHelp,
  },
  {
    destination: BACK_DESTINATION.SETTINGS_FEEDBACK,
    summaryKey: "settings.about.feedbackSummary",
    icon: MessageSquareText,
  },
];

const DEBUG_ICON: Record<DebugScreen["route"], IconProps["as"]> = {
  [DEBUG_SCREEN.BACKGROUND.route]: Activity,
  [DEBUG_SCREEN.QURAN_AUDIO.route]: BookText,
  [DEBUG_SCREEN.DIAGNOSTICS.route]: Bug,
  [DEBUG_SCREEN.WIDGETS.route]: Layers,
};

const DEBUG_ROWS = Object.values(DEBUG_SCREEN).map((entry) => ({
  ...entry,
  icon: DEBUG_ICON[entry.route],
}));

export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectionHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const isDebugEnabled = useDebugModeStore((s) => s.isEnabled);
  const restartOnboarding = useAppStore((s) => s.restartOnboarding);

  const open = async (href: Href) => {
    await selectionHaptic();
    router.push(href);
  };

  const restart = async () => {
    await selectionHaptic();
    restartOnboarding();
  };

  const rowsOf = (rows: readonly AboutRow[]) =>
    rows.map(({ destination, summaryKey, icon }) => (
      <ListRow
        key={destination.route}
        variant={LIST_ROW_VARIANT.GROUPED}
        icon={icon}
        tile
        title={t(destination.title)}
        status={t(summaryKey)}
        hint={t("a11y.opens", { name: t(destination.title) })}
        onPress={() => open(destination.href)}
      />
    ));

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <ScreenSky>
      <SkyScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("settings.about.title")}
            subtitle={t("settings.about.intro")}
            back={{ fallback: BACK_DESTINATION.SETTINGS }}
          />
        </SkyOccluder>

        <SkyOccluder>
          <ScreenContent paddingTop="$2" paddingBottom="$8" gap="$section">
            <AboutBrand />

            <Section title={t("settings.about.latest")} kind={SECTION_KIND.LABEL}>
              <ReleaseNotesCard />
            </Section>

            <Section title={t("brand.name")} kind={SECTION_KIND.LABEL}>
              <ListGroup>{rowsOf(NEDAA_ROWS)}</ListGroup>
            </Section>

            <Section title={t("settings.about.helpSection")} kind={SECTION_KIND.LABEL}>
              <ListGroup>{rowsOf(HELP_ROWS)}</ListGroup>
            </Section>

            <VersionLine />

            {isDebugEnabled ? (
              <Section title={DEBUG_COPY.SECTION} kind={SECTION_KIND.LABEL}>
                <ListGroup>
                  {DEBUG_ROWS.map(({ route, href, label, icon }) => (
                    <ListRow
                      key={route}
                      variant={LIST_ROW_VARIANT.GROUPED}
                      icon={icon}
                      title={label}
                      onPress={() => open(href)}
                    />
                  ))}
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={RotateCcw}
                    title={DEBUG_COPY.RESTART_ONBOARDING}
                    hint={DEBUG_COPY.RESTART_ONBOARDING_HINT}
                    onPress={restart}
                  />
                  <PhoneZoneRow />
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={MapPin}
                    title={DEBUG_COPY.SHOW_CITY_CHANGE}
                    onPress={showNamedCityChange}
                  />
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={MapPinned}
                    title={DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED}
                    onPress={showUnnamedCityChange}
                  />
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={Play}
                    title={DEBUG_COPY.RUN_CITY_CHECK}
                    onPress={() => void runCityCheckNow()}
                  />
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={ListChecks}
                    title={DEBUG_COPY.SHOW_CITY_CHECK_MEMORY}
                    onPress={showCityCheckMemory}
                  />
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    icon={Eraser}
                    title={DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY}
                    onPress={clearCityCheckMemory}
                  />
                </ListGroup>
              </Section>
            ) : null}
          </ScreenContent>
        </SkyOccluder>
      </SkyScrollView>
    </ScreenSky>
  );
}
