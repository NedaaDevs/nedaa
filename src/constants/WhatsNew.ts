import type { Href } from "expo-router";
import { PixelRatio } from "react-native";

import { usePreferencesStore } from "@/stores/preferences";
import { TextSize } from "@/enums/app";
import { nearestTextSize, OS_FONT_SCALE_OFFER_THRESHOLD } from "@/constants/TextSize";

// What's New announcement ids. Entries announce features to EXISTING users; a
// fresh install seeds all current ids as seen at onboarding completion, so
// only users who installed before a feature shipped see its announcement.
// Ship a new announcement by adding an entry to WHATS_NEW_ENTRIES (newest
// first) and its id here.
export const WhatsNewId = {
  TEXT_SIZE: "text-size-v1",
  // TODO(quran-gate): entries retire once the feature has been public for a release.
  QURAN: "quran-feature-v1",
  QURAN_AUDIO: "quran-audio-v1",
  IMPORTANT_DAYS: "important-days-v1",
  UMRAH: "umrah-guide-v1",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type WhatsNewId = (typeof WhatsNewId)[keyof typeof WhatsNewId];

export const ALL_WHATS_NEW_IDS: WhatsNewId[] = Object.values(WhatsNewId);

export type WhatsNewGateContext = {
  umrahInProgress: boolean;
  fontScale: number;
  textSizeOfferHandled: boolean;
};

/** What an entry's action does: open a screen, or turn a feature on. */
export const WHATS_NEW_ACTION = { NAVIGATE: "navigate", OPT_IN: "optIn" } as const;

export type WhatsNewAction =
  | { type: typeof WHATS_NEW_ACTION.NAVIGATE; route: Href; ctaKey: string }
  | {
      type: typeof WHATS_NEW_ACTION.OPT_IN;
      ctaKey: string;
      isEnabled: () => boolean;
      enable: () => void;
    };

export type WhatsNewEntry = {
  id: WhatsNewId;
  titleKey: string;
  descriptionKey: string;
  applies?: (ctx: WhatsNewGateContext) => boolean;
  announceGate?: (ctx: WhatsNewGateContext) => boolean;
  action: WhatsNewAction;
};

// Newest release first.
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    id: WhatsNewId.TEXT_SIZE,
    titleKey: "whatsNew.textSize.title",
    descriptionKey: "whatsNew.textSize.description",
    applies: (ctx) => ctx.fontScale >= OS_FONT_SCALE_OFFER_THRESHOLD,
    announceGate: (ctx) => !ctx.textSizeOfferHandled,
    action: {
      type: WHATS_NEW_ACTION.OPT_IN,
      ctaKey: "whatsNew.enable",
      isEnabled: () => usePreferencesStore.getState().textSize !== TextSize.DEFAULT,
      enable: () =>
        usePreferencesStore.getState().setTextSize(nearestTextSize(PixelRatio.getFontScale())),
    },
  },
  {
    id: WhatsNewId.QURAN_AUDIO,
    titleKey: "quranAudio.featureCard.title",
    descriptionKey: "quranAudio.featureCard.description",
    action: {
      type: WHATS_NEW_ACTION.NAVIGATE,
      route: "/quran-listen",
      ctaKey: "quranAudio.featureCard.explore",
    },
  },
  {
    id: WhatsNewId.QURAN,
    titleKey: "quran.featureCard.title",
    descriptionKey: "quran.featureCard.description",
    action: {
      type: WHATS_NEW_ACTION.NAVIGATE,
      route: "/(tabs)/quran",
      ctaKey: "quran.featureCard.explore",
    },
  },
  {
    id: WhatsNewId.IMPORTANT_DAYS,
    titleKey: "whatsNew.importantDays.title",
    descriptionKey: "whatsNew.importantDays.description",
    action: {
      type: WHATS_NEW_ACTION.OPT_IN,
      ctaKey: "whatsNew.enable",
      isEnabled: () => usePreferencesStore.getState().showImportantDaysOnHome,
      enable: () => usePreferencesStore.getState().setShowImportantDaysOnHome(true),
    },
  },
  {
    id: WhatsNewId.UMRAH,
    titleKey: "umrah.featureCard.title",
    descriptionKey: "umrah.featureCard.description",
    announceGate: (ctx) => !ctx.umrahInProgress,
    action: {
      type: WHATS_NEW_ACTION.NAVIGATE,
      route: "/umrah",
      ctaKey: "umrah.featureCard.explore",
    },
  },
];

const applies = (entry: WhatsNewEntry, ctx: WhatsNewGateContext) => entry.applies?.(ctx) ?? true;

export const getApplicableEntries = (
  ctx: WhatsNewGateContext,
  entries: WhatsNewEntry[] = WHATS_NEW_ENTRIES
): WhatsNewEntry[] => entries.filter((e) => applies(e, ctx));

export const getUnseenEntries = (
  seenIds: string[],
  ctx: WhatsNewGateContext,
  entries: WhatsNewEntry[] = WHATS_NEW_ENTRIES
): WhatsNewEntry[] =>
  entries.filter(
    (e) => !seenIds.includes(e.id) && applies(e, ctx) && (e.announceGate?.(ctx) ?? true)
  );
