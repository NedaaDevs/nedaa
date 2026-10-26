import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppearanceChoices } from "@/components/settings/AppearanceChoices";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkyHero } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SECTION_KIND } from "@/constants/Section";
import { appearancePreview } from "@/utils/appearancePreview";

export default function AppearanceScreen() {
  return (
    <ScreenSky>
      <AppearanceContent />
    </ScreenSky>
  );
}

/** The screen over its sky; the page sky is the preview the hero names. */
const AppearanceContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sky = usePageSky();
  const { kicker, title, note } = appearancePreview(t, sky.mode, sky.scheme, sky.phase);

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t("settings.appearance")}
          subtitle={t("settings.themes.intro")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <ScreenContent paddingTop="$2" paddingBottom="$8" gap="$5">
        <SkyHero
          accessibilityLabel={t("a11y.join", {
            first: t("a11y.join", { first: kicker, second: title }),
            second: note,
          })}>
          <Text size="sm" bold typography="helper" color="$fg">
            {kicker}
          </Text>
          <Text size="xl" bold typography="title" color="$fg" marginTop="$0.5">
            {title}
          </Text>
          <Text size="sm" fontWeight="600" typography="helper" color="$fg">
            {note}
          </Text>
        </SkyHero>

        <SkyOccluder>
          <Section title={t("settings.themes.choose")} kind={SECTION_KIND.LABEL}>
            <VStack gap="$3">
              <AppearanceChoices />
            </VStack>
          </Section>
        </SkyOccluder>
      </ScreenContent>
    </SkyScrollView>
  );
};
