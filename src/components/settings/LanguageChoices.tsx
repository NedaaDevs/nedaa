import { useTranslation } from "react-i18next";

import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { LANGUAGE_ORDER } from "@/constants/Locales";
import type { AppLocale } from "@/enums/app";
import { useChooseLanguage } from "@/hooks/useChooseLanguage";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useAppStore } from "@/stores/app";

/** The app's languages, each also in its own name; a choice applies at once. */
export const LanguageChoices = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const locale = useAppStore((state) => state.locale);
  const chooseLanguage = useChooseLanguage();

  const choose = (code: AppLocale) => {
    hapticSelection();
    void chooseLanguage(code);
  };

  return (
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
  );
};
