import { useEffect } from "react";

// Stores
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";

// Screenshot mode
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { DEFAULT_ATHKAR_DATA } from "@/constants/AthkarData";

// Types
import type { Athkar, AthkarProgress } from "@/types/athkar";

// Builds the morning list the same way useInitializeAthkar does (id =
// `${order}-morning`) so the focus reader/player ids stay consistent with
// production. The athkar-focus route is reachable via deep link without the
// landing screen ever mounting, so its morning list can be empty.
function buildMorningList(): Athkar[] {
  const list: Athkar[] = [];
  for (const athkar of DEFAULT_ATHKAR_DATA) {
    if (athkar.id === "26" && athkar.count === 10) continue;
    if (athkar.type === ATHKAR_TYPE.MORNING || athkar.type === ATHKAR_TYPE.ALL) {
      list.push({ ...athkar, id: `${athkar.order}-morning` });
    }
  }
  return list;
}

// In screenshot mode the SQLite-backed progress is empty (fresh DB) and the
// athkar lists are only populated by useInitializeAthkar on the landing screen.
// AthkarList.initializeSession asynchronously reloads currentProgress from the
// empty DB, so seeded progress has to be re-asserted to win that race. A small
// number of timed re-applies keeps the captured screen stable without touching
// production behavior (the effects no-op when no screenshot seed is active).
const REASSERT_DELAYS_MS = [0, 350, 900, 1600] as const;

function buildSeededProgress(
  morningIds: string[],
  perItemCount: number,
  completed: number
): AthkarProgress[] {
  return morningIds.map((athkarId, index) => {
    const isDone = index < completed;
    return {
      athkarId,
      currentCount: isDone ? perItemCount : 0,
      totalCount: perItemCount,
      completed: isDone,
    };
  });
}

/**
 * Seeds the athkar landing screen for App Store screenshots: forces the morning
 * period, trims the displayed morning list to `total` items, and marks
 * `completed` of them done so the progress bar reads completed/total. Also seeds
 * a believable streak. Returns the period to display so the tab UI can sync.
 */
export function useAthkarLandingScreenshotSeed(): "morning" | "evening" | null {
  const seed = useScreenshotSeed("athkar");
  const morningAthkarList = useAthkarStore((s) => s.morningAthkarList);

  useEffect(() => {
    if (!seed) return;

    const period = seed.period === "evening" ? ATHKAR_TYPE.EVENING : ATHKAR_TYPE.MORNING;
    const total = Math.max(1, seed.progress.total);
    const completed = Math.max(0, Math.min(seed.progress.completed, total));

    const timers: ReturnType<typeof setTimeout>[] = [];

    const apply = () => {
      const state = useAthkarStore.getState();
      const fullMorning = state.morningAthkarList;
      if (fullMorning.length === 0) return;

      // Trim the displayed list to `total` so completed/total maps cleanly to
      // the streak card percentage (completed / displayed list length).
      const trimmed = fullMorning.slice(0, Math.min(total, fullMorning.length));
      const seededProgress = buildSeededProgress(
        trimmed.map((a) => a.id),
        // Single-count items keep the card UI clean for the screenshot.
        1,
        completed
      );

      useAthkarStore.setState({
        morningAthkarList: trimmed,
        currentType: period,
        currentProgress: seededProgress,
        todayCompleted: { morning: false, evening: false },
        streak: {
          currentStreak: 7,
          longestStreak: 30,
          lastCompletedDate: null,
          isPaused: false,
          toleranceDays: 0,
        },
      });
    };

    REASSERT_DELAYS_MS.forEach((delay) => {
      timers.push(setTimeout(apply, delay));
    });

    return () => timers.forEach(clearTimeout);
  }, [seed, morningAthkarList.length]);

  if (!seed) return null;
  return seed.period;
}

/**
 * Seeds the focused athkar reader (athkar-focus route) for App Store
 * screenshots: ensures the morning list exists, selects a reciter, and drives
 * the audio store into a paused mid-playback state at the seeded position.
 */
export function useAthkarFocusScreenshotSeed(): boolean {
  const seed = useScreenshotSeed("athkar-with-audio");
  const morningAthkarList = useAthkarStore((s) => s.morningAthkarList);

  useEffect(() => {
    if (!seed) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const apply = () => {
      const state = useAthkarStore.getState();
      let list = state.morningAthkarList;
      if (list.length === 0) {
        list = buildMorningList();
        useAthkarStore.setState({ morningAthkarList: list });
      }
      if (list.length === 0) return;

      const trackIndex = Math.min(seed.trackIndex, list.length - 1);
      const currentAthkar = list[trackIndex];

      useAthkarStore.setState({
        currentType: ATHKAR_TYPE.MORNING,
        currentAthkarIndex: trackIndex,
        lastMorningIndex: trackIndex,
        playerState: "paused",
        currentAthkarId: currentAthkar.id,
        currentThikrId: currentAthkar.id,
        repeatProgress: { current: 1, total: 3 },
        sessionProgress: { current: trackIndex + 1, total: list.length },
      });

      useAthkarAudioStore.setState({
        playbackMode: PLAYBACK_MODE.MANUAL,
        selectedReciterId: "screenshot-reciter",
        onboardingCompleted: true,
        duration: seed.totalSeconds,
        position: seed.pausedAtSeconds,
      });
    };

    REASSERT_DELAYS_MS.forEach((delay) => {
      timers.push(setTimeout(apply, delay));
    });

    return () => timers.forEach(clearTimeout);
  }, [seed, morningAthkarList.length]);

  return seed !== null;
}
