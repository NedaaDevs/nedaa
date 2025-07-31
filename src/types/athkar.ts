import { ATHKAR_TYPE } from "@/constants/Athkar";

export type AthkarType = (typeof ATHKAR_TYPE)[keyof typeof ATHKAR_TYPE];

export type Athkar = {
  id: string; //  "1-morning", "1-evening"
  title: string;
  text: string;
  count: number;
  type: AthkarType;
  order: number;
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
  setMorningAthkarList: (list: Athkar[]) => void;
  setEveningAthkarList: (list: Athkar[]) => void;
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
  cleanUpOldData: () => Promise<void>;
};
