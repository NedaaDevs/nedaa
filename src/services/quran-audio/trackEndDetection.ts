import type { Reason } from "react-native-nitro-player";

import { NITRO_REASON } from "@/services/audio/nitroSession";

// Nitro reports a track change's cause inconsistently across platforms: Android
// maps ExoPlayer's auto-transition to "end", while iOS emits "skip" for every
// advance within a loaded playlist, natural or user-driven. Where the reason is
// ambiguous, the progress trail decides — a track that advanced from within a
// tick of its duration played itself out.
//
// Nitro's periodic observer slows down on long items (1s, 2s past an hour, 5s
// past two), so the last tick before a natural end can trail the true end by a
// full interval. Al-Baqarah reaches the slowest tier, hence the scaling.
const progressTickInterval = (duration: number): number => {
  if (duration > 7200) return 5;
  if (duration > 3600) return 2;
  return 1;
};

// Half a tick of slack on top, covering jitter in observer delivery.
const TOLERANCE_TICKS = 1.5;

type TrackEndInput = {
  reason: Reason | undefined;
  // Furthest position reached since the last track change or seek. Using the peak
  // rather than the latest tick keeps a stray tick from the incoming track from
  // erasing the outgoing track's trail.
  peakPosition: number;
  duration: number;
};

export const isNaturalTrackEnd = ({ reason, peakPosition, duration }: TrackEndInput): boolean => {
  if (reason === NITRO_REASON.END) return true;
  if (duration <= 0) return false;
  return duration - peakPosition <= progressTickInterval(duration) * TOLERANCE_TICKS;
};
