import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { differenceInDays } from "date-fns";

import { UmrahDB } from "@/services/umrah-db";
import { UMRAH_STAGES, AUTO_RESET_DAYS } from "@/constants/UmrahGuide";
import type { ActiveProgress, StageId, UmrahRecord } from "@/types/umrah";

const generateId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

type UmrahGuideState = {
  activeProgress: ActiveProgress | null;
  history: UmrahRecord[];
  isDbInitialized: boolean;

  // Actions
  initializeDb: () => Promise<void>;
  startUmrah: () => void;
  advanceStep: () => void;
  goToPreviousStep: () => void;
  completeStage: () => void;
  moveToNextStage: () => void;
  toggleChecklistItem: (item: string) => void;
  completeUmrah: () => Promise<UmrahRecord | null>;
  resetProgress: () => void;
  checkAutoReset: () => void;
  loadHistory: () => Promise<void>;

  // Computed helpers
  getCurrentStage: () => (typeof UMRAH_STAGES)[number] | null;
  getCurrentStep: () => (typeof UMRAH_STAGES)[number]["steps"][number] | null;
  isStageCompleted: (stageId: StageId) => boolean;
  getOverallProgress: () => { completed: number; total: number };
  getProgressFraction: () => number;
};

export const useUmrahGuideStore = create<UmrahGuideState>()(
  devtools(
    persist(
      (set, get) => ({
        activeProgress: null,
        history: [],
        isDbInitialized: false,

        initializeDb: async () => {
          if (get().isDbInitialized) return;
          await UmrahDB.initialize();
          const history = await UmrahDB.getHistory();
          set({ history, isDbInitialized: true });
        },

        startUmrah: () => {
          const now = new Date().toISOString();
          set({
            activeProgress: {
              currentStageIndex: 0,
              currentStepIndex: 0,
              completedStages: [],
              checklistState: {},
              startedAt: now,
              updatedAt: now,
            },
          });
        },

        advanceStep: () => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          const stage = UMRAH_STAGES[activeProgress.currentStageIndex];
          if (!stage) return;

          const nextStepIndex = activeProgress.currentStepIndex + 1;
          if (nextStepIndex < stage.steps.length) {
            set({
              activeProgress: {
                ...activeProgress,
                currentStepIndex: nextStepIndex,
                updatedAt: new Date().toISOString(),
              },
            });
          }
        },

        goToPreviousStep: () => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          if (activeProgress.currentStepIndex > 0) {
            set({
              activeProgress: {
                ...activeProgress,
                currentStepIndex: activeProgress.currentStepIndex - 1,
                updatedAt: new Date().toISOString(),
              },
            });
          }
        },

        completeStage: () => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          const stage = UMRAH_STAGES[activeProgress.currentStageIndex];
          if (!stage) return;

          const completedStages = [...activeProgress.completedStages, stage.id];
          set({
            activeProgress: {
              ...activeProgress,
              completedStages,
              checklistState: {},
              updatedAt: new Date().toISOString(),
            },
          });
        },

        moveToNextStage: () => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          const nextStageIndex = activeProgress.currentStageIndex + 1;
          if (nextStageIndex < UMRAH_STAGES.length) {
            set({
              activeProgress: {
                ...activeProgress,
                currentStageIndex: nextStageIndex,
                currentStepIndex: 0,
                checklistState: {},
                updatedAt: new Date().toISOString(),
              },
            });
          }
        },

        toggleChecklistItem: (item: string) => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          const checklistState = {
            ...activeProgress.checklistState,
            [item]: !activeProgress.checklistState[item],
          };
          set({
            activeProgress: {
              ...activeProgress,
              checklistState,
              updatedAt: new Date().toISOString(),
            },
          });
        },

        completeUmrah: async () => {
          const { activeProgress } = get();
          if (!activeProgress) return null;

          const now = new Date();
          const startedAt = new Date(activeProgress.startedAt);
          const durationMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);

          const { HijriNative } = await import("@/utils/date");
          const hijriDate = HijriNative.today("Asia/Riyadh");
          const hijriStr = `${hijriDate.day} ${hijriDate.month} ${hijriDate.year}`;

          const record: UmrahRecord = {
            id: generateId(),
            startedAt: activeProgress.startedAt,
            completedAt: now.toISOString(),
            durationMinutes,
            hijriDate: hijriStr,
            gregorianDate: now.toISOString().split("T")[0],
          };

          await UmrahDB.saveRecord(record);

          set({
            activeProgress: null,
            history: [record, ...get().history],
          });

          return record;
        },

        resetProgress: () => {
          set({ activeProgress: null });
        },

        checkAutoReset: () => {
          const { activeProgress } = get();
          if (!activeProgress) return;

          const daysSinceUpdate = differenceInDays(new Date(), new Date(activeProgress.updatedAt));
          if (daysSinceUpdate > AUTO_RESET_DAYS) {
            set({ activeProgress: null });
          }
        },

        loadHistory: async () => {
          const history = await UmrahDB.getHistory();
          set({ history });
        },

        getCurrentStage: () => {
          const { activeProgress } = get();
          if (!activeProgress) return null;
          return UMRAH_STAGES[activeProgress.currentStageIndex] ?? null;
        },

        getCurrentStep: () => {
          const { activeProgress } = get();
          if (!activeProgress) return null;
          const stage = UMRAH_STAGES[activeProgress.currentStageIndex];
          if (!stage) return null;
          return stage.steps[activeProgress.currentStepIndex] ?? null;
        },

        isStageCompleted: (stageId: StageId) => {
          const { activeProgress } = get();
          if (!activeProgress) return false;
          return activeProgress.completedStages.includes(stageId);
        },

        getOverallProgress: () => {
          const { activeProgress } = get();
          if (!activeProgress) return { completed: 0, total: UMRAH_STAGES.length };
          return {
            completed: activeProgress.completedStages.length,
            total: UMRAH_STAGES.length,
          };
        },

        getProgressFraction: () => {
          const { activeProgress } = get();
          if (!activeProgress) return 0;

          const totalStages = UMRAH_STAGES.length;
          const completedStages = activeProgress.completedStages.length;

          const currentStage = UMRAH_STAGES[activeProgress.currentStageIndex];
          const stagePartial = currentStage
            ? activeProgress.currentStepIndex / currentStage.steps.length
            : 0;

          return (completedStages + stagePartial) / totalStages;
        },
      }),
      {
        name: "umrah-guide-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          activeProgress: state.activeProgress,
        }),
        onRehydrateStorage: () => (state) => {
          state?.checkAutoReset();
        },
      }
    )
  )
);
