import { AppLocale } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import ms from "@/localization/locales/ms.json";
import ur from "@/localization/locales/ur.json";

/** Each locale's bundle, keyed so a locale without one fails the build. */
export const LOCALE_BUNDLES: Record<AppLocale, Record<string, unknown>> = {
  [AppLocale.EN]: en,
  [AppLocale.AR]: ar,
  [AppLocale.MS]: ms,
  [AppLocale.UR]: ur,
};

/** Edited in the repo, so each one carries every key. */
export const HAND_WRITTEN_LOCALES = [
  AppLocale.EN,
  AppLocale.AR,
] as const satisfies readonly AppLocale[];

export type HandWrittenLocale = (typeof HAND_WRITTEN_LOCALES)[number];

const isHandWritten = (locale: AppLocale): locale is HandWrittenLocale =>
  HAND_WRITTEN_LOCALES.some((handWritten) => handWritten === locale);

/** Downloaded from Crowdin, which may not have a new key yet. */
export const CROWDIN_LOCALES = Object.values(AppLocale).filter((locale) => !isHandWritten(locale));
