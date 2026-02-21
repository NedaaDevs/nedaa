import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Appearance, Image } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as MediaControls from "expo-media-controls";

import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useAthkarStore } from "@/stores/athkar";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { MessageToast } from "@/components/feedback/MessageToast";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar-audio");

export const useAthkarAudioBridge = () => {
  const { t } = useTranslation();
  const playerA = useAudioPlayer();
  const playerB = useAudioPlayer();
  const statusA = useAudioPlayerStatus(playerA);
  const statusB = useAudioPlayerStatus(playerB);

  // Stable refs — update silently without re-running the main effect
  const playerARef = useRef(playerA);
  const playerBRef = useRef(playerB);
  const isMountedRef = useRef(true);

  // Keep refs in sync with latest player instances (no effect re-run)
  useEffect(() => {
    playerARef.current = playerA;
  }, [playerA]);
  useEffect(() => {
    playerBRef.current = playerB;
  }, [playerB]);

  const incrementCount = useAthkarStore((s) => s.incrementCount);

  const setPlayerState = useAthkarAudioStore((s) => s.setPlayerState);
  const setCurrentThikrId = useAthkarAudioStore((s) => s.setCurrentThikrId);
  const setCurrentRepeat = useAthkarAudioStore((s) => s.setCurrentRepeat);
  const setTotalRepeats = useAthkarAudioStore((s) => s.setTotalRepeats);
  const setSessionProgress = useAthkarAudioStore((s) => s.setSessionProgress);
  const setAudioDuration = useAthkarAudioStore((s) => s.setAudioDuration);
  const setAudioPosition = useAthkarAudioStore((s) => s.setAudioPosition);

  // Bridge mounts ONCE — empty deps
  useEffect(() => {
    isMountedRef.current = true;
    log.i("Bridge", "Audio bridge mounted");

    // Pass stable refs to singleton
    athkarPlayer.setPlayers(playerARef, playerBRef);

    // Resolve app icons for lock screen artwork
    const lightIcon = Image.resolveAssetSource(require("../../assets/images/icon.png"))?.uri;
    const darkIcon = Image.resolveAssetSource(require("../../assets/images/ios-dark.png"))?.uri;

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

      const isDark = Appearance.getColorScheme() === "dark";
      const artworkUrl = isDark ? darkIcon : lightIcon;
      return { title, artist, artworkUrl };
    });

    // Lock screen next/previous controls
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
      onSessionComplete: () => {
        if (isMountedRef.current) {
          setPlayerState("idle");
        }
      },
    });

    return () => {
      log.i("Bridge", "Audio bridge unmounted");
      isMountedRef.current = false;
      MediaControls.disable();
      nextSub.remove();
      prevSub.remove();
      athkarPlayer.notifyPlayerUnmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed status from active player only
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (athkarPlayer.getActiveSlot() === "a") {
      athkarPlayer.onStatusUpdate(statusA);
    }
  }, [statusA]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    if (athkarPlayer.getActiveSlot() === "b") {
      athkarPlayer.onStatusUpdate(statusB);
    }
  }, [statusB]);

  return { player: playerA };
};
