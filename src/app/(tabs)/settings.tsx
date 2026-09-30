import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isPinningSupported } from "expo-widgets";

import { SupportActions } from "@/components/settings/SupportActions";
import { SETTINGS_ROWS } from "@/components/settings/settingsRows";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { SECTION_KIND } from "@/constants/Section";
import {
  SETTINGS_LAYOUT,
  SETTINGS_ROW,
  SETTINGS_SECTION,
  type SettingsRowId,
} from "@/constants/SettingsRoot";
import { PlatformType } from "@/enums/app";
import { useAlarmSupported } from "@/hooks/useAlarmSupported";
import { useHaptic } from "@/hooks/useHaptic";
import { useSettingsSummaries } from "@/hooks/useSettingsSummaries";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAppStore } from "@/stores/app";
import { isAthkarSupported } from "@/utils/athkar";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const selectionHaptic = useHaptic("selection");
  const alarmSupported = useAlarmSupported();
  const locale = useAppStore((state) => state.locale);
  const summaries = useSettingsSummaries();

  const hidden: Partial<Record<SettingsRowId, boolean>> = {
    [SETTINGS_ROW.ALARMS]: !alarmSupported,
    [SETTINGS_ROW.ATHKAR]: !isAthkarSupported(locale),
    // iOS explains how to add a widget; Android's screen is built on pinning.
    [SETTINGS_ROW.WIDGETS]: Platform.OS !== PlatformType.IOS && !isPinningSupported(),
  };

  const open = async (href: Href) => {
    await selectionHaptic();
    router.push(href);
  };

  const rowOf = (id: SettingsRowId) => {
    const { destination, icon, titleKey = destination.title } = SETTINGS_ROWS[id];
    const title = t(titleKey);
    return (
      <ListRow
        key={id}
        variant={LIST_ROW_VARIANT.GROUPED}
        icon={icon}
        tile
        title={title}
        status={summaries[id]}
        hint={t("a11y.opens", { name: title })}
        onPress={() => open(destination.href)}
      />
    );
  };

  return (
    // The sky runs under both bars; the content scrolls clear of the tab bar.
    <SkyBackground>
      <SkyScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: Math.max(tabBarInset, insets.bottom),
        }}>
        <SkyOccluder>
          <ScreenHeader title={t("settings.title")} back />
        </SkyOccluder>

        <SkyOccluder>
          <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$section">
            {SETTINGS_LAYOUT.map(({ id, labelKey, rows }) => {
              const shown = rows.filter((row) => !hidden[row]);
              if (!shown.length) return null;
              return (
                <Section key={id} title={t(labelKey)} kind={SECTION_KIND.LABEL}>
                  <ListGroup>
                    {id === SETTINGS_SECTION.NEDAA ? (
                      // One child, so the group draws no rule under the tiles.
                      <VStack>
                        <SupportActions />
                        {shown.map(rowOf)}
                      </VStack>
                    ) : (
                      shown.map(rowOf)
                    )}
                  </ListGroup>
                </Section>
              );
            })}
          </VStack>
        </SkyOccluder>
      </SkyScrollView>
    </SkyBackground>
  );
}
