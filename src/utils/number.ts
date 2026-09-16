import type { TFunction } from "i18next";
import appStore from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { localizeDigits, toWesternDigits } from "@/utils/digits";

export const formatNumberToLocale = (str: string) =>
  localizeDigits(
    str,
    appStore.getState().locale,
    usePreferencesStore.getState().useWesternNumerals
  );

// File size with localized digits and unit label (e.g. "12.3 م ب" in Arabic).
export const formatFileSizeLocale = (bytes: number, t: TFunction): string => {
  const units = ["bytes", "kb", "mb", "gb"] as const;
  if (bytes <= 0) return `${formatNumberToLocale("0")} ${t("common.units.bytes")}`;
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formatNumberToLocale(String(value))} ${t(`common.units.${units[i]}`)}`;
};

// Parses digits a reader typed, which may be in either set.
export const normalizeNumber = toWesternDigits;
