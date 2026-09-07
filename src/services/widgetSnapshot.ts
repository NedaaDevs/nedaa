import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { AthkarDB } from "@/services/athkar-db";
import { PrayerTimesDB } from "@/services/db";
import { QadaDB } from "@/services/qada-db";
import { buildHijriTodayPayload, buildImportantDaysPayload } from "@/services/widgetPayloads";
import {
  buildWidgetSnapshot,
  todayUtcBounds,
  writeSnapshotFile,
} from "@/services/widgetSnapshotFile";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { useQadaStore } from "@/stores/qada";
import { AppLogger } from "@/utils/appLogger";
import { dateToInt } from "@/utils/date";
import { refreshAllWidgets } from "../../modules/expo-widgets/src";

import type { WidgetSnapshotInputs } from "@/services/widgetSnapshotFile";

const log = AppLogger.create("widgets");

// Each database read completes before the next begins: the two locks are non-reentrant
// and nesting one run() inside another deadlocks.
const gatherSnapshotInputs = async (): Promise<WidgetSnapshotInputs> => {
  const t = i18n.t.bind(i18n);
  const nowMs = Date.now();
  const { hijriDaysOffset } = useAppStore.getState();
  const timezone = useLocationStore.getState().locationDetails.timezone;
  const useWesternNumerals = usePreferencesStore.getState().useWesternNumerals;
  const zonedNow = toZonedTime(nowMs, timezone);
  const today = dateToInt(zonedNow);

  const prayerDays = await PrayerTimesDB.getPrayerTimesByDateRange(
    today,
    dateToInt(addDays(zonedNow, 2))
  );
  const athkar = await AthkarDB.getWidgetSnapshotData(today);
  const { startIso, endIso } = todayUtcBounds(nowMs, timezone);
  const qadaCompletedToday = await QadaDB.getCompletedCountBetween(startIso, endIso);
  const { totalMissed, totalCompleted } = useQadaStore.getState();

  return {
    nowMs,
    timezone,
    hijriDaysOffset,
    useWesternNumerals,
    prayerDays,
    hijriLabel: buildHijriTodayPayload(t, timezone, hijriDaysOffset).hijriLabel,
    importantDays: buildImportantDaysPayload(t, timezone, hijriDaysOffset),
    athkar,
    qadaTotals: { totalMissed, totalCompleted },
    qadaCompletedToday,
  };
};

// Android only: both values describe Android components. Widgets are decoration, so a
// failure here is logged and the previous snapshot stays on disk.
export const writeWidgetSnapshot = async (): Promise<void> => {
  if (Platform.OS !== PlatformType.ANDROID) return;
  try {
    await writeSnapshotFile(buildWidgetSnapshot(await gatherSnapshotInputs()));
  } catch (e) {
    log.e("Snapshot", "widget snapshot write failed", e instanceof Error ? e : undefined);
  }
};

// Write then repaint. Repaints Android only: iOS widgets read the database tables and
// their WidgetKit reload budget must not be spent on Android-side changes.
export const syncWidgetSnapshot = async (): Promise<void> => {
  if (Platform.OS !== PlatformType.ANDROID) return;
  await writeWidgetSnapshot();
  await refreshAllWidgets();
};
