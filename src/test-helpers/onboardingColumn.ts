import { onboardingColumn, type ColumnInput } from "@/components/onboarding/column";

/** A first run on a fresh device: nothing granted, nothing stored. */
export const FIRST_RUN: ColumnInput = {
  languageRequested: false,
  hasCity: false,
  choseAutomaticLocation: false,
  locationPermissionGranted: false,
  todayStored: false,
  fetchStarted: false,
  notificationsGranted: false,
  alarmsOffered: false,
  fajrAlarmOn: false,
  fridayAlarmOn: false,
};

/** The column for a first run with `patch` applied. */
export const columnFor = (patch: Partial<ColumnInput> = {}) =>
  onboardingColumn({ ...FIRST_RUN, ...patch });
