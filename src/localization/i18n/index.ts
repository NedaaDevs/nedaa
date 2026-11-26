import "intl-pluralrules";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

// Translations
import translationAR from "@/localization/locales/ar.json";
import translationEN from "@/localization/locales/en.json";
import translationMS from "@/localization/locales/ms.json";
import translationUR from "@/localization/locales/ur.json";
// Enums
import { AppLocale } from "@/enums/app";
import { numeralPostProcessor } from "@/localization/numerals";

/** The one namespace every locale file loads into. */
export const I18N_NAMESPACE = "translation";

const resources = {
  ar: { [I18N_NAMESPACE]: translationAR },
  en: { [I18N_NAMESPACE]: translationEN },
  ms: { [I18N_NAMESPACE]: translationMS },
  ur: { [I18N_NAMESPACE]: translationUR },
};

const initI18n = () => {
  const deviceLanguage = getLocales()[0]?.languageCode?.toLowerCase().slice(0, 2) as AppLocale;

  // Initialize i18n with React integration
  // eslint-disable-next-line import/no-named-as-default-member
  i18n
    .use(initReactI18next)
    .use(numeralPostProcessor)
    .init({
      resources,
      lng: deviceLanguage,
      fallbackLng: AppLocale.EN,
      interpolation: {
        escapeValue: false,
      },
      postProcess: [numeralPostProcessor.name],
    });
};

initI18n();

export default i18n;
