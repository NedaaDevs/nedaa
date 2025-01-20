import "i18next";
import en from "@/localization/locales/en/translation.json";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof en;
    };
  }
}
