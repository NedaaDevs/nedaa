// Enums
import { AppLocale } from "@/enums/app";

export const RTL_LOCALES: AppLocale[] = [AppLocale.AR, AppLocale.UR] as const;

/** CLDR's plural category for two, which Arabic says with its own dual word. */
export const PLURAL_DUAL: Intl.LDMLPluralRule = "two";
