import { onboardingColumn, upgradeColumn, type ColumnInput } from "@/components/onboarding/column";

/** A first run on a fresh device: nothing granted, nothing stored. */
export const FIRST_RUN: ColumnInput = {
  languageRequested: false,
  hasCity: false,
  hadCity: false,
  choseAutomaticLocation: false,
  locationPermissionGranted: false,
  todayStored: false,
  fetchStarted: false,
  notificationsGranted: false,
  notificationsUndetermined: true,
  alarmsOffered: false,
  fajrAlarmOn: false,
  fridayAlarmOn: false,
};

/** A 2.x user with a city, the day stored, and notifications answered. */
export const UPGRADER: ColumnInput = {
  ...FIRST_RUN,
  hasCity: true,
  hadCity: true,
  todayStored: true,
  notificationsGranted: true,
  notificationsUndetermined: false,
  alarmsOffered: true,
};

/** The column for a first run with `patch` applied. */
export const columnFor = (patch: Partial<ColumnInput> = {}) =>
  onboardingColumn({ ...FIRST_RUN, ...patch });

/** The upgrade path's column for `UPGRADER` with `patch` applied. */
export const upgradeColumnFor = (patch: Partial<ColumnInput> = {}) =>
  upgradeColumn({ ...UPGRADER, ...patch });
