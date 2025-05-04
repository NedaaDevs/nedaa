import "i18next";
import en from "@/localization/locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    translation: typeof en & {
      hijriMonths: (typeof en)["hijriMonths"];
    };
  }
}
