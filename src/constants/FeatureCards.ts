// Feature-discovery card ids. Cards announce features to EXISTING users; a
// fresh install seeds all current ids as dismissed at onboarding completion,
// so only users who installed before a feature shipped see its card. Ship a
// new announcement by adding an id here (and its config where it renders).
export const FeatureCardId = {
  // TODO(quran-gate): cards retire once the feature has been public for a release.
  QURAN: "quran-feature-v1",
  QURAN_AUDIO: "quran-audio-v1",
  IMPORTANT_DAYS: "important-days-v1",
  UMRAH: "umrah-guide-v1",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type FeatureCardId = (typeof FeatureCardId)[keyof typeof FeatureCardId];

export const ALL_FEATURE_CARD_IDS: FeatureCardId[] = Object.values(FeatureCardId);
