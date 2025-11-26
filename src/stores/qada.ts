import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Services
import { QadaDB } from "@/services/qada-db";

// Utils
import { mapSnakeToCamel } from "@/utils/caseConversion";

// Utils
import { scheduleQadaNotifications } from "@/utils/qadaNotificationScheduler";
import i18next from "@/localization/i18n";

// Stores
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";

// Types
import type { QadaHistory, QadaSettings } from "@/services/qada-db";

/**
 * Sync qada notifications with current settings
 * Handles both scheduling new notifications and cancelling when disabled
 */
const syncQadaNotifications = async () => {
  try {
    const qadaStore = useQadaStore.getState();
    const notificationStore = useNotificationStore.getState();
    const customSoundsStore = useCustomSoundsStore.getState();

    // Get current settings from database
    const settings = await QadaDB.getSettings();

    // Validate settings exist before proceeding
    if (!settings) {
      console.warn("[Qada Store] No settings found, skipping notification sync");
      return;
    }

    const remainingCount = qadaStore.getRemaining();

    // Call the scheduler - it handles cancellation when disabled/none
    await scheduleQadaNotifications(
      settings,
      remainingCount,
      i18next.t,
      notificationStore.settings,
      customSoundsStore.customSounds
    );
  } catch (error) {
    console.error("[Qada Store] Error syncing notifications:", error);
  }
};

export type QadaState = {
  // Data
  totalMissed: number;
  totalCompleted: number;
  totalOriginal: number;
  history: QadaHistory[];
  pendingEntries: QadaHistory[];
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
  updateSettings: (
    settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
  ) => Promise<boolean>;
  loadHistory: (limit?: number) => Promise<void>;
  loadPendingEntries: () => Promise<void>;
  completeEntry: (id: number) => Promise<boolean>;
  completeSpecificEntry: (id: number) => Promise<boolean>;
  completeAllEntries: () => Promise<boolean>;
  deleteEntry: (id: number) => Promise<boolean>;
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
        totalOriginal: 0,
        history: [],
        pendingEntries: [],
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
              const totalOriginal = fastData.total_missed + fastData.total_completed;
              console.log(
                "[Qada Store] Loaded from DB - totalMissed:",
                fastData.total_missed,
                "totalCompleted:",
                fastData.total_completed,
                "totalOriginal:",
                totalOriginal
              );
              set({
                totalMissed: fastData.total_missed,
                totalCompleted: fastData.total_completed,
                totalOriginal: totalOriginal,
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

            // Load pending entries
            const pendingEntries = await QadaDB.getPendingEntries();
            set({ pendingEntries });

            // Sync notifications after loading data
            await syncQadaNotifications();

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

              // Reload history and pending entries
              await get().loadHistory();
              await get().loadPendingEntries();

              // Sync notifications with new count
              await syncQadaNotifications();
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
         * Update settings
         */
        updateSettings: async (
          settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
        ) => {
          try {
            set({ isLoading: true, hasError: false, errorMessage: "" });

            const success = await QadaDB.updateSettings(settings);
            if (success) {
              // Map snake_case DB fields to camelCase state properties using utility
              const mappedSettings = mapSnakeToCamel(settings, {
                reminder_type: "reminderType",
                reminder_days: "reminderDays",
                custom_date: "customDate",
                privacy_mode: (val: number) => val === 1, // Convert to boolean for privacyMode
              });

              set((state) => ({
                ...state,
                ...Object.fromEntries(
                  Object.entries(mappedSettings).map(([key, value]) => [
                    key,
                    value !== undefined ? value : state[key as keyof typeof state],
                  ])
                ),
              }));

              // Sync notifications after settings update
              await syncQadaNotifications();
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
         * Load pending entries
         */
        loadPendingEntries: async () => {
          try {
            const pendingEntries = await QadaDB.getPendingEntries();
            set({ pendingEntries });
          } catch (error) {
            console.error("[Qada Store] Error loading pending entries:", error);
          }
        },

        /**
         * Complete an entry (swipe left action)
         */
        completeEntry: async (id: number) => {
          try {
            const state = get();
            console.log(
              "[Qada Store] Before complete - totalMissed:",
              state.totalMissed,
              "totalCompleted:",
              state.totalCompleted,
              "remaining:",
              state.getRemaining()
            );

            const success = await QadaDB.completeOneDayFromEntry(id);
            if (success) {
              // Reload data to update totals and entries
              await get().loadData();

              const newState = get();
              console.log(
                "[Qada Store] After complete - totalMissed:",
                newState.totalMissed,
                "totalCompleted:",
                newState.totalCompleted,
                "remaining:",
                newState.getRemaining(),
                "pending entries:",
                newState.pendingEntries.length
              );

              // Sync notifications with new count
              await syncQadaNotifications();
            }
            return success;
          } catch (error) {
            console.error("[Qada Store] Error completing entry:", error);
            return false;
          }
        },

        completeSpecificEntry: async (id: number) => {
          try {
            const success = await QadaDB.updateEntryStatus(id, "completed");
            if (success) {
              // Reload data to update totals and entries
              await get().loadData();

              // Sync notifications with new count
              await syncQadaNotifications();
            }
            return success;
          } catch (error) {
            console.error("[Qada Store] Error completing specific entry:", error);
            return false;
          }
        },

        /**
         * Complete all pending entries (full swipe action)
         */
        completeAllEntries: async () => {
          try {
            const state = get();
            const pendingEntries = state.pendingEntries;

            // Complete all pending entries
            for (const entry of pendingEntries) {
              await QadaDB.updateEntryStatus(entry.id, "completed");
            }

            // Reload data to update totals and entries
            await get().loadData();

            // Sync notifications with new count
            await syncQadaNotifications();
            return true;
          } catch (error) {
            console.error("[Qada Store] Error completing all entries:", error);
            return false;
          }
        },

        /**
         * Delete an entry (swipe right action)
         */
        deleteEntry: async (id: number) => {
          try {
            const state = get();
            console.log(
              "[Qada Store] Before delete - totalMissed:",
              state.totalMissed,
              "totalCompleted:",
              state.totalCompleted,
              "remaining:",
              state.getRemaining()
            );

            const success = await QadaDB.updateEntryStatus(id, "deleted");
            if (success) {
              // Reload data to update totals and entries
              await get().loadData();

              const newState = get();
              console.log(
                "[Qada Store] After delete - totalMissed:",
                newState.totalMissed,
                "totalCompleted:",
                newState.totalCompleted,
                "remaining:",
                newState.getRemaining(),
                "pending entries:",
                newState.pendingEntries.length
              );

              // Sync notifications with new count
              await syncQadaNotifications();
            }
            return success;
          } catch (error) {
            console.error("[Qada Store] Error deleting entry:", error);
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
                totalOriginal: 0,
                history: [],
              });

              // Cancel notifications since all data is reset
              const { cancelAllQadaNotifications } = await import(
                "@/utils/qadaNotificationScheduler"
              );
              await cancelAllQadaNotifications();
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
          return Math.max(0, state.totalMissed);
        },

        /**
         * Get completion percentage
         */
        getCompletionPercentage: () => {
          const state = get();
          if (state.totalOriginal === 0) return 0;
          return Math.round((state.totalCompleted / state.totalOriginal) * 100);
        },
      }),
      {
        name: "qada-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          totalMissed: state.totalMissed,
          totalCompleted: state.totalCompleted,
          totalOriginal: state.totalOriginal,
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
