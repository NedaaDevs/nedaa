import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageHero } from "@/components/settings/LanguageHero";
import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { LANGUAGE_ORDER } from "@/constants/Locales";
import { SECTION_KIND } from "@/constants/Section";
import type { AppLocale } from "@/enums/app";
import { useChooseLanguage } from "@/hooks/useChooseLanguage";
import { useHaptic } from "@/hooks/useHaptic";
import { useAppStore } from "@/stores/app";

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
  const hapticSelection = useHaptic("selection");
  const locale = useAppStore((state) => state.locale);
  const chooseLanguage = useChooseLanguage();

  const choose = (code: AppLocale) => {
    hapticSelection();
    void chooseLanguage(code);
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
          title={t("settings.language")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
        <LanguageHero />

        <SkyOccluder>
          <Section title={t("settings.languages.choose")} kind={SECTION_KIND.LABEL}>
            <ChoiceGroup label={t("settings.languages.choose")} variant={LIST_ROW_VARIANT.GROUPED}>
              {LANGUAGE_ORDER.map((code) => {
                const title = t(`settings.languages.${code}.title`);
                const native = t(`settings.languages.${code}.nativeTitle`);
                return (
                  <ChoiceRow
                    key={code}
                    title={title}
                    // A name the same in both languages is shown once.
                    subtitle={native === title ? undefined : native}
                    subtitleLocale={code}
                    selected={locale === code}
                    onPress={() => choose(code)}
                  />
                );
              })}
            </ChoiceGroup>
          </Section>
        </SkyOccluder>
      </VStack>
    </SkyScrollView>
  );
};
