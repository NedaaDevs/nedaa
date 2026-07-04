import type { TFunction } from "i18next";
import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import { HijriNative } from "@/utils/date";
import { upcomingImportantDays } from "@/utils/importantDays";
import { sharedDb } from "@/services/db";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { formatNumberToLocale } from "@/utils/number";
import { refreshAllWidgets } from "../../modules/expo-widgets/src";
import { reloadAllWidgets } from "../../modules/expo-widget/src";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("widgets");

export type WidgetImportantDay = {
  id: string;
  name: string;
  hijriLabel: string;
  dateISO: string;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Numerals go through formatNumberToLocale so Arabic renders Eastern-Arabic
// digits (honoring the Western-numerals preference), same as in-app text.
const hijriLabelOf = (t: TFunction, day: number, month: number, year: number) =>
  `${formatNumberToLocale(String(day))} ${t(`hijriMonths.${month - 1}`)} ${formatNumberToLocale(String(year))}`;

// Pure builders (tested); the writer below persists them for the Kotlin side.
export const buildImportantDaysPayload = (
  t: TFunction,
  timezone: string,
  hijriDaysOffset: number
): WidgetImportantDay[] =>
  upcomingImportantDays({ timezone, hijriDaysOffset }).map((d) => ({
    id: d.id,
    name: t(d.i18nKey),
    hijriLabel: hijriLabelOf(t, d.hijriDay, d.hijriMonth, d.hijriYear),
    dateISO: iso(d.expectedGregorian),
  }));

export const buildHijriTodayPayload = (
  t: TFunction,
  timezone: string,
  hijriDaysOffset: number
): { hijriLabel: string } => {
  const raw = HijriNative.today(timezone);
  const today = hijriDaysOffset !== 0 ? HijriNative.addDays(raw, hijriDaysOffset) : raw;
  return { hijriLabel: hijriLabelOf(t, today.day, today.month, today.year) };
};

// Writes Important Days + today's Hijri date + locale config into the DB the
// Android widgets read. Routed through the app's shared serialized connection
// (a second handle to nedaa.db NPEs mid-session). Widgets are decoration: any
// failure here must never break the app.
export const syncWidgetPayloads = async (): Promise<void> => {
  // Android reads these tables from nedaa.db directly; iOS reads the same DB
  // via the App Group container (see getDirectory in services/db).
  if (Platform.OS !== PlatformType.ANDROID && Platform.OS !== PlatformType.IOS) return;
  try {
    const t = i18n.t.bind(i18n);
    const { hijriDaysOffset } = useAppStore.getState();
    const timezone = useLocationStore.getState().locationDetails.timezone;
    const days = buildImportantDaysPayload(t, timezone, hijriDaysOffset);
    const h = buildHijriTodayPayload(t, timezone, hijriDaysOffset);
    const locale = useAppStore.getState().locale;
    const useWesternNumerals = usePreferencesStore.getState().useWesternNumerals ? 1 : 0;

    await sharedDb.run(async (db) => {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS widget_important_days
           (id TEXT PRIMARY KEY, name TEXT, hijriLabel TEXT, dateISO TEXT, sort INTEGER);
         CREATE TABLE IF NOT EXISTS widget_hijri_today (id INTEGER PRIMARY KEY CHECK (id = 1), hijriLabel TEXT);
         CREATE TABLE IF NOT EXISTS widget_config (id INTEGER PRIMARY KEY CHECK (id = 1), locale TEXT, useWesternNumerals INTEGER);`
      );
      await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM widget_important_days`);
        for (let i = 0; i < days.length; i++) {
          const d = days[i];
          await db.runAsync(
            `INSERT INTO widget_important_days (id, name, hijriLabel, dateISO, sort) VALUES (?,?,?,?,?)`,
            [d.id, d.name, d.hijriLabel, d.dateISO, i]
          );
        }
        await db.runAsync(
          `INSERT OR REPLACE INTO widget_hijri_today (id, hijriLabel) VALUES (1, ?)`,
          [h.hijriLabel]
        );
        // Locale + numeral preference so Kotlin-rendered numbers/dates match the
        // app's chosen language (not the device locale).
        await db.runAsync(
          `INSERT OR REPLACE INTO widget_config (id, locale, useWesternNumerals) VALUES (1, ?, ?)`,
          [locale, useWesternNumerals]
        );
      });
    });
    if (Platform.OS === PlatformType.IOS) {
      reloadAllWidgets();
    } else {
      refreshAllWidgets();
    }
  } catch (e) {
    // Failed sync = stale/empty widgets until the next trigger.
    log.e("Sync", "widget payload sync failed", e instanceof Error ? e : undefined);
  }
};
