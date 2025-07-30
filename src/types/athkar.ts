import { ATHKAR_TYPE } from "@/constants/Athkar";

export type AthkarType = (typeof ATHKAR_TYPE)[keyof typeof ATHKAR_TYPE];

export type Athkar = {
  id: string;
  title: string;
  text: string;
  count: number;
  type: AthkarType;
  order: number;
};

export type AthkarProgress = {
  athkarId: string;
  currentCount: number;
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
  athkarList: Athkar[];
  currentProgress: AthkarProgress[];
  streak: Streak;
  focusMode: boolean;
  currentAthkarIndex: number;
  currentType: Exclude<AthkarType, "all">;
  shortVersion: boolean;
  todayCompleted: {
    morning: boolean;
    evening: boolean;
  };
  settings: {
    autoMoveToNext: boolean;
    showStreak: boolean;
  };
};

// Actions
export type AthkarActions = {
  // Synchronous
  setAthkarList: (list: Athkar[]) => void;
  incrementCount: (athkarId: string) => void;
  decrementCount: (athkarId: string) => void;
  toggleFocusMode: () => void;
  moveToNext: () => void;
  moveToPrevious: () => void;
  setCurrentAthkarIndex: (index: number) => void;
  setCurrentType: (type: Exclude<AthkarType, "all">) => void;
  toggleAutoMove: () => void;
  toggleShowStreak: () => void;
  toggleShortVersion: () => void;

  // Asynchronous
  initializeStore: () => Promise<void>;
  initializeSession: (type: Exclude<AthkarType, "all">) => Promise<void>;
  pauseStreak: () => Promise<void>;
  resumeStreak: () => Promise<void>;
  updateToleranceDays: (days: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  checkAndUpdateDailyProgress: () => Promise<void>;
  reloadStreakFromDB: () => Promise<void>;
  forceRecalculateStreak: () => Promise<void>;
  cleanUpOldData: () => Promise<void>;
  loadTodayProgress: () => Promise<void>;
};
