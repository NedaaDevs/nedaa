import { ATHKAR_TYPE } from "@/constants/Athkar";
import type { PlayerState } from "@/types/athkar-audio";

export type AthkarType = (typeof ATHKAR_TYPE)[keyof typeof ATHKAR_TYPE];

export type AthkarGroupInfo = {
  texts: string[];
  audioIds: string[];
  itemsPerRound: number;
};

export type Athkar = {
  id: string; //  "1-morning", "1-evening"
  title: string;
  text: string;
  count: number;
  type: AthkarType;
  order: number;
  group?: AthkarGroupInfo;
};

export type AthkarProgress = {
  athkarId: string;
  currentCount: number;
  totalCount: number;
  completed: boolean;
};

export type Streak = {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  isPaused: boolean;
  toleranceDays: number;
};

// State
export type AthkarState = {
  morningAthkarList: Athkar[];
  eveningAthkarList: Athkar[];
  currentProgress: AthkarProgress[];
  streak: Streak;
  focusMode: boolean;
  currentAthkarIndex: number;
  lastMorningIndex: number;
  lastEveningIndex: number;
  currentType: Exclude<AthkarType, "all">;
  shortVersion: boolean;
  todayCompleted: {
    morning: boolean;
    evening: boolean;
  };
  settings: {
    autoMoveToNext: boolean;
    showStreak: boolean;
    showTranslation: boolean;
  };

  // Audio playback state (merged from athkar-audio store for atomic updates)
  playerState: PlayerState;
  currentAthkarId: string | null;
  currentThikrId: string | null;
  repeatProgress: { current: number; total: number };
  sessionProgress: { current: number; total: number };
  groupProgress: {
    groupIndex: number;
    itemsPerRound: number;
    round: number;
    totalRounds: number;
    count: number;
    totalCount: number;
  } | null;
};

export type TrackTransitionParams = {
  previousAthkarId: string | null;
  newAthkarId: string;
  newThikrId: string;
  repeatProgress: { current: number; total: number };
  sessionProgress: { current: number; total: number };
  newIndex: number;
};

// Actions
export type AthkarActions = {
  // Audio state (sole writer: player singleton)
  setPlayerState: (state: PlayerState) => void;
  setCurrentTrack: (thikrId: string | null, athkarId: string | null) => void;
  setRepeatProgress: (progress: { current: number; total: number }) => void;
  setSessionProgress: (progress: { current: number; total: number }) => void;
  setGroupProgress: (progress: AthkarState["groupProgress"]) => void;
  transitionTrack: (params: TrackTransitionParams) => void;
  resetPlaybackState: () => void;

  // Synchronous
  setMorningAthkarList: (list: Athkar[]) => void;
  setEveningAthkarList: (list: Athkar[]) => void;
  incrementCount: (athkarId: string, skipAutoMove?: boolean) => void;
  decrementCount: (athkarId: string) => void;
  toggleFocusMode: () => void;
  findOptimalAthkarIndex: (type: Exclude<AthkarType, "all">) => number;
  moveToNext: () => void;
  moveToPrevious: () => void;
  setCurrentAthkarIndex: (index: number) => void;
  setCurrentType: (type: Exclude<AthkarType, "all">) => void;
  toggleAutoMove: () => void;
  toggleShowStreak: () => void;
  toggleShowTranslation: () => void;
  toggleShortVersion: () => void;
  updateLastIndex: (type: Exclude<AthkarType, "all">, index: number) => void;
  getLastIndex: (type: Exclude<AthkarType, "all">) => number;

  // Asynchronous
  initializeStore: () => Promise<void>;
  initializeTodayData: () => Promise<void>;
  updateAthkarLists: (morningList: Athkar[], eveningList: Athkar[]) => Promise<void>;
  initializeSession: (type: Exclude<AthkarType, "all">) => Promise<void>;
  loadTodayProgress: () => Promise<void>;
  checkAndUpdateSessionCompletion: (athkarId: string) => Promise<void>;
  pauseStreak: () => Promise<void>;
  resumeStreak: () => Promise<void>;
  updateToleranceDays: (days: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  reloadStreakFromDB: () => Promise<void>;
  validateDailyStreak: () => Promise<void>;
  cleanUpOldData: () => Promise<void>;
};
