import type { TFunction } from "i18next";
import appStore from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";

export const formatNumberToLocale = (str: string) => {
  if (
    appStore.getState().locale.startsWith("ar") &&
    !usePreferencesStore.getState().useWesternNumerals
  ) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return str.replace(/[0-9]/g, (digit: string): string => arabicDigits[parseInt(digit)]);
  }
  return str;
};

// File size with localized digits and unit label (e.g. "12.3 م ب" in Arabic).
export const formatFileSizeLocale = (bytes: number, t: TFunction): string => {
  const units = ["bytes", "kb", "mb", "gb"] as const;
  if (bytes <= 0) return `${formatNumberToLocale("0")} ${t("common.units.bytes")}`;
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formatNumberToLocale(String(value))} ${t(`common.units.${units[i]}`)}`;
};

export const normalizeNumber = (str: string) => {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
};
