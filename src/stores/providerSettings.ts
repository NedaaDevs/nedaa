import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Constants
import { PRAYER_TIME_PROVIDERS, ProviderKey } from "@/constants/providers";

// Types
import type { AladhanSettings } from "@/types/providers/aladhan";

type ProviderSettings = AladhanSettings; // | SecondProviderSettings

/**
 * Provider settings mapped by provider Id
 */
interface AllProviderSettings {
  [providerId: number]: ProviderSettings | undefined;
}

interface ProviderSettingsState {
  currentProviderId: number;

  // Settings for all providers by Id
  allSettings: AllProviderSettings;

  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ProviderSettingsActions {
  /**
   * Get current provider settings
   */
  getCurrentSettings: <T = ProviderSettings>() => T | undefined;

  /**
   * Get current provider key
   */
  getCurrentProviderKey: () => ProviderKey | undefined;

  /**
   * Switch to a different provider by Id
   */
  selectProviderById: (providerId: number) => void;

  /**
   * Switch to a different provider by key
   */
  selectProviderByKey: (providerKey: ProviderKey) => void;

  /**
   * Update settings for current provider
   */
  updateCurrentSettings: (updates: Partial<ProviderSettings>) => void;

  /**
   * Save current provider settings
   */
  saveSettings: () => Promise<void>;

  /**
   * Reset current provider to defaults
   */
  resetCurrentSettings: () => void;
}

type ProviderSettingsStore = ProviderSettingsState & ProviderSettingsActions;

// Helper to get provider key by Id
const getProviderKeyById = (id: number): ProviderKey | undefined => {
  const entry = Object.entries(PRAYER_TIME_PROVIDERS).find(([_, provider]) => provider.id === id);
  return entry ? (entry[0] as ProviderKey) : undefined;
};

// Helper to get default settings for a provider by Id
const getProviderDefaultsById = (providerId: number): ProviderSettings => {
  const providerKey = getProviderKeyById(providerId);
  if (!providerKey) return {} as ProviderSettings;

  const config = PRAYER_TIME_PROVIDERS[providerKey];

  switch (providerId) {
    case 1: // ALADHAN
      return {
        method: config.defaults.method || 3, // Default to MWL
        madhab: config.defaults.school,
        midnightMode: config.defaults.midnightMode,
        latitudeAdjustment: config.defaults.latitudeAdjustmentMethod,
      } as AladhanSettings;
    default:
      return {} as ProviderSettings;
  }
};

const initialState: ProviderSettingsState = {
  currentProviderId: PRAYER_TIME_PROVIDERS.ALADHAN.id,
  allSettings: {
    [PRAYER_TIME_PROVIDERS.ALADHAN.id]: getProviderDefaultsById(PRAYER_TIME_PROVIDERS.ALADHAN.id),
  },
  isDirty: false,
  isLoading: false,
  error: null,
};

export const useProviderSettingsStore = create<ProviderSettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        getCurrentSettings: <T = ProviderSettings>() => {
          const state = get();
          return state.allSettings[state.currentProviderId] as T | undefined;
        },

        getCurrentProviderKey: () => {
          const state = get();
          return getProviderKeyById(state.currentProviderId);
        },

        selectProviderById: (providerId) => {
          set(
            (state) => {
              // Initialize provider settings if not exists
              const newSettings =
                state.allSettings[providerId] || getProviderDefaultsById(providerId);

              return {
                currentProviderId: providerId,
                allSettings: {
                  ...state.allSettings,
                  [providerId]: newSettings,
                },
                isDirty: false,
                error: null,
              };
            },
            false,
            "providerSettings/selectProvider"
          );
        },

        selectProviderByKey: (providerKey) => {
          const providerId = PRAYER_TIME_PROVIDERS[providerKey]?.id;
          if (providerId) {
            get().selectProviderById(providerId);
          }
        },

        updateCurrentSettings: (updates: Partial<ProviderSettings>) => {
          set((state) => ({
            allSettings: {
              ...state.allSettings,
              [state.currentProviderId]: {
                ...state.allSettings[state.currentProviderId],
                ...updates,
              } as ProviderSettings,
            },
            isDirty: true,
            error: null,
          }));
        },

        saveSettings: async () => {
          set({ isLoading: true, error: null });

          try {
            const state = get();
            const currentSettings = state.allSettings[state.currentProviderId];

            console.log("🚀 => saveSettings: => currentSettings:", currentSettings);
            // Simulate async save
            await new Promise((resolve) => setTimeout(resolve, 500));

            set({ isDirty: false, isLoading: false });
          } catch (error) {
            set({
              error: (error as Error).message || "Failed to save settings",
              isLoading: false,
            });
            throw error;
          }
        },

        resetCurrentSettings: () => {
          set((state) => ({
            allSettings: {
              ...state.allSettings,
              [state.currentProviderId]: getProviderDefaultsById(state.currentProviderId),
            },
            isDirty: false,
            error: null,
          }));
        },
      }),
      {
        name: "provider-settings",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          currentProviderId: state.currentProviderId,
          allSettings: state.allSettings,
        }),
      }
    ),
    { name: "ProviderSettings" }
  )
);
