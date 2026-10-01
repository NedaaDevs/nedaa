import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkyHero, SkySwatch } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SECTION_KIND } from "@/constants/Section";
import type { AppMode } from "@/enums/app";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useHaptic } from "@/hooks/useHaptic";
import { appearancePreview } from "@/utils/appearancePreview";
import { skySwatchFor } from "@/utils/sky";

export default function AppearanceScreen() {
  return (
    <SkyBackground>
      <AppearanceContent />
    </SkyBackground>
  );
}

/** The screen over its sky; the page sky is the preview the hero names. */
const AppearanceContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hapticSelection = useHaptic("selection");
  const chooseMode = useChooseMode();
  const sky = usePageSky();
  const { kicker, title, note } = appearancePreview(t, sky.mode, sky.scheme, sky.phase);

  const choose = (mode: AppMode) => {
    hapticSelection();
    void chooseMode(mode);
  };

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

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
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
              <ChoiceGroup label={t("settings.appearance")}>
                {APPEARANCE_ORDER.map((mode) => (
                  <ChoiceRow
                    key={mode}
                    title={t(`settings.themes.${mode}.title`)}
                    subtitle={t(`settings.themes.${mode}.description`)}
                    selected={sky.mode === mode}
                    onPress={() => choose(mode)}
                    leading={
                      <SkySwatch
                        bands={skySwatchFor(mode)}
                        hijriDay={sky.hijriDay}
                        isRTL={sky.isRTL}
                      />
                    }
                  />
                ))}
              </ChoiceGroup>
            </VStack>
          </Section>
        </SkyOccluder>
      </VStack>
    </SkyScrollView>
  );
};
