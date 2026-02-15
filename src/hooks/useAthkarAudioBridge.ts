import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";

import * as MediaControls from "expo-media-controls";

import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useAthkarStore } from "@/stores/athkar";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { MessageToast } from "@/components/feedback/MessageToast";

export const useAthkarAudioBridge = () => {
  const { t } = useTranslation();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const playerIdRef = useRef(`athkar-audio-${Date.now()}-${Math.random()}`);
  const isMountedRef = useRef(true);

  const incrementCount = useAthkarStore((s) => s.incrementCount);

  const setPlayerState = useAthkarAudioStore((s) => s.setPlayerState);
  const setCurrentThikrId = useAthkarAudioStore((s) => s.setCurrentThikrId);
  const setCurrentRepeat = useAthkarAudioStore((s) => s.setCurrentRepeat);
  const setTotalRepeats = useAthkarAudioStore((s) => s.setTotalRepeats);
  const setSessionProgress = useAthkarAudioStore((s) => s.setSessionProgress);
  const setAudioDuration = useAthkarAudioStore((s) => s.setAudioDuration);
  const setAudioPosition = useAthkarAudioStore((s) => s.setAudioPosition);

  useEffect(() => {
    isMountedRef.current = true;

    // Enable background audio and silent mode playback
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

    // Pass player to singleton
    athkarPlayer.setPlayer(player, playerIdRef.current);

    // Wire metadata resolver for lock screen
    athkarPlayer.setMetadataResolver((_thikrId, reciterId) => {
      const currentType = useAthkarStore.getState().currentType;
      const sessionTitle = currentType === "morning" ? t("athkar.morning") : t("athkar.evening");
      const { current } = useAthkarAudioStore.getState().sessionProgress;
      const title = `${current} - ${sessionTitle}`;

      let artist = reciterId;
      const catalog = reciterRegistry.getCachedCatalog();
      if (catalog) {
        const reciter = catalog.reciters.find((r) => r.id === reciterId);
        if (reciter) {
          artist = reciter.name["ar"] ?? reciter.name["en"] ?? reciterId;
        }
      }
      return { title, artist };
    });

    // Enable lock screen next/previous track controls
    MediaControls.enable();
    const nextSub = MediaControls.onRemoteNext(() => athkarPlayer.next());
    const prevSub = MediaControls.onRemotePrevious(() => athkarPlayer.previous());

    // Wire callbacks
    athkarPlayer.setCallbacks({
      onStateChange: (state) => {
        if (isMountedRef.current) setPlayerState(state);
      },
      onCountIncrement: (athkarId) => {
        if (isMountedRef.current) incrementCount(athkarId);
      },
      onThikrChange: (thikrId, currentRepeat, totalRepeats) => {
        if (isMountedRef.current) {
          setCurrentThikrId(thikrId);
          setCurrentRepeat(currentRepeat);
          setTotalRepeats(totalRepeats);
        }
      },
      onSessionProgress: (current, total) => {
        if (isMountedRef.current) setSessionProgress({ current, total });
      },
      onAudioPosition: (position, duration) => {
        if (isMountedRef.current) {
          setAudioPosition(position);
          setAudioDuration(duration);
        }
      },
      onError: (key) => {
        if (isMountedRef.current) {
          MessageToast.showWarning(t(`athkar.audio.${key}`));
        }
      },
    });

    return () => {
      isMountedRef.current = false;
      MediaControls.disable();
      nextSub.remove();
      prevSub.remove();
      athkarPlayer.notifyPlayerUnmount(playerIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // Feed real-time status from useAudioPlayerStatus to the singleton
  useEffect(() => {
    if (!isMountedRef.current) return;
    athkarPlayer.onStatusUpdate(status);
  }, [status]);

  return { player, playerId: playerIdRef.current };
};
