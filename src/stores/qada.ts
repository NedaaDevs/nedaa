import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Services
import { QadaDB } from "@/services/qada-db";

// Types
import type { QadaHistory, QadaSettings } from "@/services/qada-db";

export type QadaState = {
  // Data
  totalMissed: number;
  totalCompleted: number;
  history: QadaHistory[];
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;

  // Settings
  reminderType: "none" | "ramadan" | "custom";
  reminderDays: number | null;
  customDate: string | null;
  privacyMode: boolean;

  // Actions
  loadData: () => Promise<void>;
  addMissed: (count: number, notes?: string) => Promise<boolean>;
  markCompleted: (count: number, date?: string, notes?: string) => Promise<boolean>;
  updateSettings: (
    settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
  ) => Promise<boolean>;
  loadHistory: (limit?: number) => Promise<void>;
  deleteHistory: (id: number) => Promise<boolean>;
  resetAll: () => Promise<boolean>;
  clearError: () => void;

  // Computed
  getRemaining: () => number;
  getCompletionPercentage: () => number;
};

export const useQadaStore = create<QadaState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        totalMissed: 0,
        totalCompleted: 0,
        history: [],
        isLoading: false,
        hasError: false,
        errorMessage: "",

        // Initial settings
        reminderType: "none",
        reminderDays: null,
        customDate: null,
        privacyMode: false,

        /**
         * Load Qada data from database
         */
        loadData: async () => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            // Initialize database if not already done
            await QadaDB.initialize();

            // Load fast data
            const fastData = await QadaDB.getQadaFast();
            if (fastData) {
              set({
                totalMissed: fastData.total_missed,
                totalCompleted: fastData.total_completed,
              });
            }

            // Load settings
            const settings = await QadaDB.getSettings();
            if (settings) {
              set({
                reminderType: settings.reminder_type,
                reminderDays: settings.reminder_days,
                customDate: settings.custom_date,
                privacyMode: settings.privacy_mode === 1,
              });
            }

            // Load recent history
            const history = await QadaDB.getHistory(50); // Last 50 entries
            set({ history });

            set({ isLoading: false });
          } catch (error) {
            console.error("[Qada Store] Error loading data:", error);
            set({
              hasError: true,
              errorMessage: error instanceof Error ? error.message : "Failed to load Qada data",
              isLoading: false,
            });
          }
        },

        /**
         * Add missed fasts
         */
        addMissed: async (count: number, notes?: string) => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            const success = await QadaDB.addMissedFasts(count, notes);
            if (success) {
              const state = get();
              set({
                totalMissed: state.totalMissed + count,
              });

              // Reload history
              await get().loadHistory();
            }

            set({ isLoading: false });
            return success;
          } catch (error) {
            console.error("[Qada Store] Error adding missed fasts:", error);
            set({
              hasError: true,
              errorMessage: error instanceof Error ? error.message : "Failed to add missed fasts",
              isLoading: false,
            });
            return false;
          }
        },

        /**
         * Mark fasts as completed
         */
        markCompleted: async (count: number, date?: string, notes?: string) => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            const success = await QadaDB.markCompleted(count, date, notes);
            if (success) {
              const state = get();
              set({
                totalCompleted: state.totalCompleted + count,
              });

              // Reload history
              await get().loadHistory();
            }

            set({ isLoading: false });
            return success;
          } catch (error) {
            console.error("[Qada Store] Error marking fasts as completed:", error);
            set({
              hasError: true,
              errorMessage:
                error instanceof Error ? error.message : "Failed to mark fasts as completed",
              isLoading: false,
            });
            return false;
          }
        },

        /**
         * Update settings
         */
        updateSettings: async (
          settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
        ) => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            const success = await QadaDB.updateSettings(settings);
            if (success) {
              set((state) => ({
                ...state,
                ...settings,
                privacyMode:
                  settings.privacy_mode !== undefined
                    ? settings.privacy_mode === 1
                    : state.privacyMode,
              }));
            }

            set({ isLoading: false });
            return success;
          } catch (error) {
            console.error("[Qada Store] Error updating settings:", error);
            set({
              hasError: true,
              errorMessage: error instanceof Error ? error.message : "Failed to update settings",
              isLoading: false,
            });
            return false;
          }
        },

        /**
         * Load history
         */
        loadHistory: async (limit?: number) => {
          try {
            const history = await QadaDB.getHistory(limit);
            set({ history });
          } catch (error) {
            console.error("[Qada Store] Error loading history:", error);
          }
        },

        /**
         * Delete a history entry
         */
        deleteHistory: async (id: number) => {
          try {
            const success = await QadaDB.deleteHistoryEntry(id);
            if (success) {
              await get().loadHistory();
            }
            return success;
          } catch (error) {
            console.error("[Qada Store] Error deleting history entry:", error);
            return false;
          }
        },

        /**
         * Reset all Qada data
         */
        resetAll: async () => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            const success = await QadaDB.resetAll();
            if (success) {
              set({
                totalMissed: 0,
                totalCompleted: 0,
                history: [],
              });
            }

            set({ isLoading: false });
            return success;
          } catch (error) {
            console.error("[Qada Store] Error resetting data:", error);
            set({
              hasError: true,
              errorMessage: error instanceof Error ? error.message : "Failed to reset data",
              isLoading: false,
            });
            return false;
          }
        },

        /**
         * Clear error state
         */
        clearError: () => {
          set({ hasError: false, errorMessage: "" });
        },

        /**
         * Get remaining fasts count
         */
        getRemaining: () => {
          const state = get();
          return Math.max(0, state.totalMissed - state.totalCompleted);
        },

        /**
         * Get completion percentage
         */
        getCompletionPercentage: () => {
          const state = get();
          if (state.totalMissed === 0) return 0;
          return Math.round((state.totalCompleted / state.totalMissed) * 100);
        },
      }),
      {
        name: "qada-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          totalMissed: state.totalMissed,
          totalCompleted: state.totalCompleted,
          reminderType: state.reminderType,
          reminderDays: state.reminderDays,
          customDate: state.customDate,
          privacyMode: state.privacyMode,
        }),
      }
    )
  )
);

export default useQadaStore;
