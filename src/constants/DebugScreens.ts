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
export const DEBUG_COPY = { SECTION: "Developer", ON: "Debug on" } as const;
