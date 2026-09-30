import type { ParseKeys } from "i18next";

/** The rows the Settings root draws, each leading to one screen. */
export const SETTINGS_ROW = {
  PREFERENCES: "preferences",
  APPEARANCE: "appearance",
  LANGUAGE: "language",
  LOCATION: "location",
  CALCULATION: "calculation",
  HIJRI: "hijri",
  NOTIFICATIONS: "notifications",
  ALARMS: "alarms",
  ATHKAR: "athkar",
  WIDGETS: "widgets",
  ABOUT: "about",
} as const;

export type SettingsRowId = (typeof SETTINGS_ROW)[keyof typeof SETTINGS_ROW];

/** The root's sections, top to bottom. */
export const SETTINGS_SECTION = {
  MOST_USED: "mostUsed",
  PLACE: "place",
  ALERTS: "alerts",
  DEVICE: "device",
  NEDAA: "nedaa",
} as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION)[keyof typeof SETTINGS_SECTION];

type SectionLayout = {
  id: SettingsSectionId;
  labelKey: ParseKeys;
  rows: readonly SettingsRowId[];
};

/** Each section: its label and its rows; Rate and Share lead Nedaa. */
export const SETTINGS_LAYOUT: readonly SectionLayout[] = [
  {
    id: SETTINGS_SECTION.MOST_USED,
    labelKey: "settings.sections.mostUsed",
    rows: [SETTINGS_ROW.PREFERENCES, SETTINGS_ROW.APPEARANCE, SETTINGS_ROW.LANGUAGE],
  },
  {
    id: SETTINGS_SECTION.PLACE,
    labelKey: "settings.sections.place",
    rows: [SETTINGS_ROW.LOCATION, SETTINGS_ROW.CALCULATION, SETTINGS_ROW.HIJRI],
  },
  {
    id: SETTINGS_SECTION.ALERTS,
    labelKey: "settings.sections.alerts",
    rows: [SETTINGS_ROW.NOTIFICATIONS, SETTINGS_ROW.ALARMS, SETTINGS_ROW.ATHKAR],
  },
  {
    id: SETTINGS_SECTION.DEVICE,
    labelKey: "settings.sections.device",
    rows: [SETTINGS_ROW.WIDGETS],
  },
  { id: SETTINGS_SECTION.NEDAA, labelKey: "brand.name", rows: [SETTINGS_ROW.ABOUT] },
];
