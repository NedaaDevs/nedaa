import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

// Translations
import translationAR from "@/localization/locales/ar/common.json";
import translationEN from "@/localization/locales/en/common.json";
import translationMS from "@/localization/locales/ms/common.json";

// Enums
import { AppLocale } from "@/enums/app";

export const defaultNS = "common";

const resources = {
  ar: translationAR,
  en: translationEN,
  ms: translationMS,
};

const initI18n = async () => {
  const deviceLanguage = getLocales()[0]
    ?.languageCode?.toLowerCase()
    .slice(0, 2) as AppLocale;

  await i18n.use(initReactI18next).init({
    resources,
    lng: deviceLanguage,
    fallbackLng: AppLocale.EN,
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
  });
};

initI18n();

export default i18n;
