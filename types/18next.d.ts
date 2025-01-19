import "i18next";
import en from "@/localization/locales/en/translations.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof en;
    };
  }
}
