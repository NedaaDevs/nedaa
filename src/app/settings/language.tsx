import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageChoices } from "@/components/settings/LanguageChoices";
import { LanguageHero } from "@/components/settings/LanguageHero";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SECTION_KIND } from "@/constants/Section";

export default function LanguageScreen() {
  return (
    <SkyBackground>
      <LanguageContent />
    </SkyBackground>
  );
}

/** The screen over its sky; the hero shows the place in the language in use. */
const LanguageContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
          title={t("settings.language")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
        <LanguageHero />

        <SkyOccluder>
          <Section title={t("settings.languages.choose")} kind={SECTION_KIND.LABEL}>
            <LanguageChoices />
          </Section>
        </SkyOccluder>
      </VStack>
    </SkyScrollView>
  );
};
