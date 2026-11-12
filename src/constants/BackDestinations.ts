import type { Href } from "expo-router";
import type { ParseKeys } from "i18next";

export type BackDestinationEntry = {
  /** The navigator's name for the screen: its file path under src/app. */
  route: string;
  href: Href;
  /** What the screen calls itself, so a back control can name it. */
  title: ParseKeys;
  /** The screen draws the sky under the status bar and pads its own top. */
  sky?: true;
};

/** Screens a back control can land on, so it can say where it goes. */
export const BACK_DESTINATION = {
  HOME: { route: "(tabs)/index", href: "/", title: "a11y.tab.home", sky: true },
  TOOLS: { route: "(tabs)/tools", href: "/(tabs)/tools", title: "tools.title", sky: true },
  SETTINGS: { route: "(tabs)/settings", href: "/settings", title: "settings.title", sky: true },
  ATHKAR: { route: "(tabs)/athkar", href: "/athkar", title: "athkar.title" },
  QADA: { route: "(tabs)/qada", href: "/qada", title: "qada.title" },
  QURAN: { route: "(tabs)/quran", href: "/quran", title: "a11y.tab.quran" },
  SETTINGS_PROVIDER: {
    route: "settings/advance/provider",
    href: "/settings/advance/provider",
    title: "settings.advance.provider.title",
    sky: true,
  },
  SETTINGS_HIJRI: {
    route: "settings/advance/hijri",
    href: "/settings/advance/hijri",
    title: "settings.hijri.date.title",
    sky: true,
  },
  SETTINGS_LANGUAGE: {
    route: "settings/language",
    href: "/settings/language",
    title: "settings.language",
    sky: true,
  },
  SETTINGS_THEME: {
    route: "settings/theme",
    href: "/settings/theme",
    title: "settings.appearance",
    sky: true,
  },
  SETTINGS_WIDGETS: {
    route: "settings/widgets",
    href: "/settings/widgets",
    title: "settings.widgets.title",
  },
  SETTINGS_ALARM: {
    route: "settings/alarm",
    href: "/settings/alarm",
    title: "alarm.settings.title",
  },
  SETTINGS_NOTIFICATION: {
    route: "settings/notification",
    href: "/settings/notification",
    title: "settings.notification.title",
  },
  SETTINGS_ATHAN_PLAYBACK: {
    route: "settings/athanPlayback",
    href: "/settings/athanPlayback",
    title: "notification.athanPlayback.title",
  },
  SETTINGS_OTHER_REMINDERS: {
    route: "settings/otherReminders",
    href: "/settings/otherReminders",
    title: "notification.otherReminders",
  },
  SETTINGS_CUSTOM_SOUNDS: {
    route: "settings/customSounds",
    href: "/settings/customSounds",
    title: "notification.customSound.title",
  },
  SETTINGS_ATHKAR: {
    route: "settings/athkar",
    href: "/settings/athkar",
    title: "settings.athkar.title",
  },
  SETTINGS_ATHKAR_AUDIO: {
    route: "settings/athkar-audio",
    href: "/settings/athkar-audio",
    title: "settings.athkarAudio.title",
  },
  SETTINGS_LOCATION: {
    route: "settings/location",
    href: "/settings/location",
    title: "settings.location.title",
    sky: true,
  },
  SETTINGS_LOCATION_PICKER: {
    route: "settings/location-picker",
    href: "/settings/location-picker",
    title: "location.picker.title",
    sky: true,
  },
  SETTINGS_PREFERENCES: {
    route: "settings/preferences",
    href: "/settings/preferences",
    title: "settings.preferences.title",
    sky: true,
  },
  SETTINGS_TEXT_SIZE: {
    route: "settings/textSize",
    href: "/settings/textSize",
    title: "settings.textSize.title",
    sky: true,
  },
  SETTINGS_ACKNOWLEDGEMENTS: {
    route: "settings/acknowledgements",
    href: "/settings/acknowledgements",
    title: "settings.acknowledgements.title",
  },
  SETTINGS_ABOUT: {
    route: "settings/about",
    href: "/settings/about",
    title: "settings.about.title",
    sky: true,
  },
  SETTINGS_PRIVACY: {
    route: "settings/privacy",
    href: "/settings/privacy",
    title: "settings.privacy.title",
    sky: true,
  },
  SETTINGS_HELP: {
    route: "settings/help",
    href: "/settings/help",
    title: "settings.help.title",
  },
  SETTINGS_FEEDBACK: {
    route: "settings/feedback",
    href: "/settings/feedback",
    title: "feedback.title",
  },
  QURAN_LISTEN: {
    route: "quran-listen/index",
    href: "/quran-listen",
    title: "tools.quranListen.title",
  },
  UMRAH: { route: "umrah/index", href: "/umrah", title: "umrah.title" },
  COMPASS: { route: "(tabs)/compass", href: "/compass", title: "tools.compass.title" },
  HIJRI_CALENDAR: {
    route: "hijri-calendar",
    href: "/hijri-calendar",
    title: "hijriCalendar.title",
  },
  HIJRI_CONVERTER: {
    route: "hijri-converter",
    href: "/hijri-converter",
    title: "tools.hijriConverter.title",
  },
  IMPORTANT_DAYS: {
    route: "important-days",
    href: "/important-days",
    title: "importantDays.title",
  },
  UMRAH_PREPARE: {
    route: "umrah/prepare/index",
    href: "/umrah/prepare",
    title: "umrah.prepare.title",
  },
  UMRAH_IHRAM: {
    route: "umrah/prepare/ihram",
    href: "/umrah/prepare/ihram",
    title: "umrah.prepare.ihram",
  },
  UMRAH_MIQAT: {
    route: "umrah/prepare/miqat",
    href: "/umrah/prepare/miqat",
    title: "umrah.prepare.miqat",
  },
  UMRAH_PROHIBITIONS: {
    route: "umrah/prepare/prohibitions",
    href: "/umrah/prepare/prohibitions",
    title: "umrah.prepare.prohibitions",
  },
} as const satisfies Record<string, BackDestinationEntry>;

export type BackDestination = (typeof BACK_DESTINATION)[keyof typeof BACK_DESTINATION];

/** The folder the tab screens sit in; the root stack names the tabs by it. */
export const [TAB_GROUP] = BACK_DESTINATION.HOME.route.split("/");

/** The entry for a navigator route name, if a back control can name it. */
export const findBackDestination = (route: string): BackDestination | undefined =>
  Object.values(BACK_DESTINATION).find((destination) => destination.route === route);

/** The advanced settings path; its index opens the Calculation screen. */
export const SETTINGS_ADVANCE = {
  route: "settings/advance/index",
  href: "/settings/advance",
} as const;
