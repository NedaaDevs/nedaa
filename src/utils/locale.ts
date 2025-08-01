// Constants
import { RTL_LOCALES } from "@/constants/Locales";
// Enums
import { AppLocale } from "@/enums/app";

export const isRTLLocale = (locale: AppLocale) => RTL_LOCALES.includes(locale);
