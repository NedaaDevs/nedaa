import { useState } from "react";

import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { PLAYER_STATE } from "@/types/athkar-audio";

type StartAthkarAudio = {
  /** Starts the audio session on `id`, or resumes it when paused there. */
  start: (id: string) => void;
  /** Audio is not set up yet: its onboarding is open in place of a start. */
  onboardingOpen: boolean;
  closeOnboarding: () => void;
};

export const useStartAthkarAudio = (): StartAthkarAudio => {
  const playerState = useAthkarStore((s) => s.playerState);
  const playingId = useAthkarStore((s) => s.currentAthkarId);
  const onboarded = useAthkarAudioStore((s) => s.onboardingCompleted);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const start = (id: string) => {
    if (!onboarded) {
      setOnboardingOpen(true);
      return;
    }
    if (playingId === id && playerState === PLAYER_STATE.PAUSED) void athkarPlayer.play();
    else void athkarPlayer.startAndJumpTo(id);
  };

  return { start, onboardingOpen, closeOnboarding: () => setOnboardingOpen(false) };
};
