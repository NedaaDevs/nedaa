import { ATHKAR_TYPE } from "@/constants/Athkar";

export type AthkarType = (typeof ATHKAR_TYPE)[keyof typeof ATHKAR_TYPE];

export type Athkar = {
  id: string;
  text: string;
  count: number;
  type: AthkarType;
  order: number;
};

export type AthkarProgress = {
  id: string;
  athkarId: string;
  currentCount: number;
  completed: boolean;
  date: string;
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
};

// Actions
export type AthkarActions = {
  setAthkarList: (list: Athkar[]) => void;
  incrementCount: (athkarId: string) => void;
  decrementCount: (athkarId: string) => void;
  toggleFocusMode: () => void;
  moveToNext: () => void;
  moveToPrevious: () => void;
  setCurrentAthkarIndex: (index: number) => void;
  initializeSession: (type: Exclude<AthkarType, "all">) => void;
  completeSession: () => void;
  updateStreak: () => void;
  pauseStreak: () => void;
  resumeStreak: () => void;
  updateToleranceDays: (days: number) => void;
  resetProgress: () => void;
};
