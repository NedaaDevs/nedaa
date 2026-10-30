import type { Href } from "expo-router";

type DebugScreenEntry = {
  /** The navigator's name for the screen: its file path under src/app. */
  route: string;
  href: Href;
  /** English on purpose: debug screens are not translated. */
  label: string;
};

/** Screens About lists while debug mode is on. */
export const DEBUG_SCREEN = {
  BACKGROUND: {
    route: "settings/background-debug",
    href: "/settings/background-debug",
    label: "Background Debug",
  },
  QURAN_AUDIO: {
    route: "settings/quran-audio-debug",
    href: "/settings/quran-audio-debug",
    label: "Quran Audio Debug",
  },
  DIAGNOSTICS: {
    route: "settings/diagnostics-debug",
    href: "/settings/diagnostics-debug",
    label: "Diagnostics Debug",
  },
  WIDGETS: {
    route: "settings/widgets-debug",
    href: "/settings/widgets-debug",
    label: "Widgets Debug",
  },
} as const satisfies Record<string, DebugScreenEntry>;

export type DebugScreen = (typeof DEBUG_SCREEN)[keyof typeof DEBUG_SCREEN];

/** About's debug copy, in English like the screens it lists. */
export const DEBUG_COPY = {
  SECTION: "Developer",
  ON: "Debug on",
  RESTART_ONBOARDING: "Restart onboarding",
  RESTART_ONBOARDING_HINT: "Shows the first-run screens again; your settings stay",
  SHOW_CITY_CHANGE: "Show city change",
  SHOW_CITY_CHANGE_UNNAMED: "Show unnamed city change",
  LOG_PHONE_ZONE: "Log the phone zone",
  RUN_CITY_CHECK: "Run the city check",
  SHOW_CITY_CHECK_MEMORY: "Show city-check memory",
  CLEAR_CITY_CHECK_MEMORY: "Clear city-check memory",
  PHONE_ZONE: "Phone zone",
  PHONE_ZONE_HINT: "Reads the zone again; a return to the app reads it too",
  NEVER_CHECKED: "never",
  LAST_CHECK: "Last check",
  KEPT: "Kept",
  NOT_ASKED: "Not asked",
  MINUTES: "min",
  HOURS: "h",
  DAYS: "d",
  /** A run's result when it put an offer up. */
  OFFERED: "offer",
  CLEARED: "Done",
  /** Shown for a source that gives no zone. */
  NO_ZONE: "none",
  /** The city the sample offer names. */
  SAMPLE_NEW_CITY: "Jeddah",
} as const;
