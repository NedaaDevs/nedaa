import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import type { ParseKeys } from "i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2,
  ChartNoAxesColumn,
  LocateFixed,
  MessageSquareText,
  Send,
  ShieldCheck,
  Smartphone,
  Tag,
} from "lucide-react-native";

import { SETTINGS_ROWS } from "@/components/settings/settingsRows";
import type { IconProps } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { SECTION_KIND } from "@/constants/Section";
import { SETTINGS_ROW } from "@/constants/SettingsRoot";
import { useHaptic } from "@/hooks/useHaptic";
import { usePreferencesStore } from "@/stores/preferences";

type PointProps = { icon: IconProps["as"]; titleKey: ParseKeys; bodyKey: ParseKeys };

/** One statement of fact: its heading, then the text in full. */
const Point = ({ icon, titleKey, bodyKey }: PointProps) => {
  const { t } = useTranslation();
  return (
    <ListRow
      variant={LIST_ROW_VARIANT.GROUPED}
      icon={icon}
      tile
      title={t(titleKey)}
      status={t(bodyKey)}
    />
  );
};

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectionHaptic = useHaptic("selection");
  const shareUsageStats = usePreferencesStore((s) => s.shareUsageStats);

  /** A row closing a group, leading to where its topic is controlled. */
  const linkRow = (destination: BackDestination, icon: IconProps["as"], status?: string) => (
    <ListRow
      variant={LIST_ROW_VARIANT.GROUPED}
      icon={icon}
      tile
      title={t(destination.title)}
      status={status}
      hint={t("a11y.opens", { name: t(destination.title) })}
      onPress={async () => {
        await selectionHaptic();
        router.push(destination.href);
      }}
    />
  );

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyBackground>
      <SkyScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("settings.privacy.title")}
            subtitle={t("settings.privacy.intro")}
            back={{ fallback: BACK_DESTINATION.SETTINGS_ABOUT }}
          />
        </SkyOccluder>

        <SkyOccluder>
          <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
            <Section title={t("settings.privacy.leaves.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <Point
                  icon={LocateFixed}
                  titleKey="settings.privacy.location.title"
                  bodyKey="settings.privacy.location.body"
                />
                <Point
                  icon={Building2}
                  titleKey="settings.privacy.city.title"
                  bodyKey="settings.privacy.city.body"
                />
                <Point
                  icon={Tag}
                  titleKey="settings.privacy.requests.title"
                  bodyKey="settings.privacy.requests.body"
                />
                {linkRow(
                  BACK_DESTINATION.SETTINGS_LOCATION,
                  SETTINGS_ROWS[SETTINGS_ROW.LOCATION].icon
                )}
              </ListGroup>
            </Section>

            <Section title={t("settings.privacy.stays.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <Point
                  icon={Smartphone}
                  titleKey="settings.privacy.records.title"
                  bodyKey="settings.privacy.stays.body"
                />
              </ListGroup>
            </Section>

            <Section title={t("settings.privacy.share.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <Point
                  icon={Send}
                  titleKey="settings.privacy.reports.title"
                  bodyKey="settings.privacy.share.body"
                />
                {linkRow(BACK_DESTINATION.SETTINGS_FEEDBACK, MessageSquareText)}
              </ListGroup>
            </Section>

            <Section title={t("settings.privacy.usage.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <Point
                  icon={ChartNoAxesColumn}
                  titleKey="settings.privacy.counts.title"
                  bodyKey="settings.privacy.usage.body"
                />
                {linkRow(
                  BACK_DESTINATION.SETTINGS_PREFERENCES,
                  SETTINGS_ROWS[SETTINGS_ROW.PREFERENCES].icon,
                  t(shareUsageStats ? "settings.privacy.usage.on" : "settings.privacy.usage.off")
                )}
              </ListGroup>
            </Section>

            <Section title={t("settings.privacy.never.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <Point
                  icon={ShieldCheck}
                  titleKey="settings.privacy.ads.title"
                  bodyKey="settings.privacy.never.body"
                />
              </ListGroup>
            </Section>
          </VStack>
        </SkyOccluder>
      </SkyScrollView>
    </SkyBackground>
  );
}
