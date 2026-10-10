/** The prayer-day phases Adaptive follows, in the order a day passes through them. */
export const PHASE = {
  DAWN: "dawn",
  DAY: "day",
  ASR: "asr",
  MAGHRIB: "maghrib",
  NIGHT: "night",
} as const;

export type Phase = (typeof PHASE)[keyof typeof PHASE];
