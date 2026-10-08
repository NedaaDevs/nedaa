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
import type { Athkar, AthkarProgress, AthkarState, Streak } from "@/types/athkar";

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

// Timed re-applies that let the focus reader's seed outlast its async setup.
const REASSERT_DELAYS_MS = [0, 350, 900, 1600] as const;

/** A believable streak for the landing screenshot. */
const SEEDED_STREAK: Streak = {
  currentStreak: 7,
  longestStreak: 30,
  lastCompletedDate: null,
  isPaused: false,
  toleranceDays: 0,
};

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

  useEffect(() => {
    if (!seed) return;

    const period = seed.period === "evening" ? ATHKAR_TYPE.EVENING : ATHKAR_TYPE.MORNING;
    const total = Math.max(1, seed.progress.total);
    const completed = Math.max(0, Math.min(seed.progress.completed, total));

    let held: Pick<AthkarState, "morningAthkarList" | "currentProgress"> | null = null;

    const apply = () => {
      const fullMorning = useAthkarStore.getState().morningAthkarList;
      if (fullMorning.length === 0) return;

      // Trim the displayed list to `total` so completed/total maps cleanly to
      // the streak card percentage (completed / displayed list length).
      const trimmed = fullMorning.slice(0, Math.min(total, fullMorning.length));
      // Single-count items keep the card UI clean for the screenshot.
      const seededProgress = buildSeededProgress(
        trimmed.map((a) => a.id),
        1,
        completed
      );
      held = { morningAthkarList: trimmed, currentProgress: seededProgress };

      useAthkarStore.setState({
        ...held,
        currentType: period,
        todayCompleted: { morning: false, evening: false },
        streak: SEEDED_STREAK,
      });
    };

    const drifted = (state: AthkarState) =>
      held === null ||
      state.morningAthkarList !== held.morningAthkarList ||
      state.currentProgress !== held.currentProgress ||
      state.streak !== SEEDED_STREAK ||
      state.currentType !== period;

    apply();
    // The session reloads progress and streak from the database after mount.
    return useAthkarStore.subscribe((state) => {
      if (drifted(state)) apply();
    });
  }, [seed]);

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
