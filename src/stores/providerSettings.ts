import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Constants
import { PRAYER_TIME_PROVIDERS, ProviderKey } from "@/constants/providers";

// Types
import type { AladhanSettings } from "@/types/providers/aladhan";

// Utils
import { waitForHydration } from "@/utils/storeHydration";
import { AppLogger } from "@/utils/appLogger";

type ProviderSettings = AladhanSettings; // | SecondProviderSettings

/**
 * Provider settings mapped by provider Id
 */
interface AllProviderSettings {
  [providerId: string]: ProviderSettings | undefined;
}

interface ProviderSettingsState {
  currentProviderId: string;

  // Settings for all providers by Id
  allSettings: AllProviderSettings;

  isModified: boolean;
  isLoading: boolean;
  error: string | null;

  /**
   * Requests one forced refetch at next launch, for settings whose times may not
   * reflect them. Persisted so it survives a launch that fails or is killed early.
   */
  pendingReapply: boolean;
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
  selectProviderById: (providerId: string) => void;

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

  /** Clears the dirty flag once the settings have reached the times. */
  markSettingsApplied: () => void;

  /**
   * Clear the reapply flag once the forced refetch has succeeded.
   */
  clearPendingReapply: () => void;
}

type ProviderSettingsStore = ProviderSettingsState & ProviderSettingsActions;

// Helper to get provider key by Id
const getProviderKeyById = (id: string): ProviderKey | undefined => {
  const entry = Object.entries(PRAYER_TIME_PROVIDERS).find(([_, provider]) => provider.id === id);
  return entry ? (entry[0] as ProviderKey) : undefined;
};

const getProviderDefaultsById = (providerId: string): ProviderSettings => {
  const providerKey = getProviderKeyById(providerId);
  if (!providerKey) return {} as ProviderSettings;

  const config = PRAYER_TIME_PROVIDERS[providerKey];

  switch (providerId) {
    case PRAYER_TIME_PROVIDERS.ALADHAN.id: // ALADHAN
      return {
        method: config.defaults.method,
        madhab: config.defaults.school,
        midnightMode: config.defaults.midnightMode,
        latitudeAdjustment: config.defaults.latitudeAdjustment,
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
  isModified: false,
  isLoading: false,
  error: null,
  pendingReapply: false,
};

type PersistedProviderSettings = {
  currentProviderId: number | string;
  allSettings: Record<string, any>;
  pendingReapply?: boolean;
};

const V0_PROVIDER_ID_MAP: Record<string, string> = { "1": "aladhan" };

/**
 * Only runs for a persisted version behind the current one, so every path requests a
 * reapply: such an install's times are not guaranteed to reflect its stored settings.
 */
export const migrateProviderSettings = (persisted: any, version: number) => {
  const old = persisted as PersistedProviderSettings;

  if (version === 0) {
    const newId =
      typeof old.currentProviderId === "number"
        ? V0_PROVIDER_ID_MAP[String(old.currentProviderId)] || "aladhan"
        : old.currentProviderId;
    const newSettings: Record<string, any> = {};
    for (const [key, value] of Object.entries(old.allSettings)) {
      newSettings[V0_PROVIDER_ID_MAP[key] || key] = value;
    }
    return { ...old, currentProviderId: newId, allSettings: newSettings, pendingReapply: true };
  }

  return { ...old, pendingReapply: true };
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
          set((state) => {
            // Initialize provider settings if not exists
            const newSettings =
              state.allSettings[providerId] || getProviderDefaultsById(providerId);

            return {
              currentProviderId: providerId,
              allSettings: {
                ...state.allSettings,
                [providerId]: newSettings,
              },
              isModified: false,
              error: null,
            };
          });
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
            isModified: true,
            error: null,
          }));
        },

        saveSettings: async () => {
          set({ isLoading: true, error: null });

          try {
            const state = get();
            const currentSettings = state.allSettings[state.currentProviderId];

            if (!currentSettings) {
              throw new Error("No settings found for current provider");
            }

            // isModified is the caller's to clear, once the apply pipeline lands.
            set({
              allSettings: {
                ...state.allSettings,
                [state.currentProviderId]: currentSettings,
              },
              isLoading: false,
            });
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
            isModified: false,
            error: null,
          }));
        },

        markSettingsApplied: () => set({ isModified: false }),

        clearPendingReapply: () => set({ pendingReapply: false }),
      }),
      {
        name: "provider-settings",
        version: 2,
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          currentProviderId: state.currentProviderId,
          allSettings: state.allSettings,
          pendingReapply: state.pendingReapply,
        }),
        migrate: migrateProviderSettings,
      }
    ),
    { name: "ProviderSettings" }
  )
);

const HYDRATION_TIMEOUT_MS = 5000;

/**
 * Reads the reapply flag once the store has rehydrated. Read synchronously at startup
 * the store still holds its defaults, which reports no reapply is due. The flag stays
 * persisted on timeout, so the next launch tries again.
 */
export const awaitPendingReapply = async (): Promise<boolean> => {
  await waitForHydration(useProviderSettingsStore.persist, {
    timeoutMs: HYDRATION_TIMEOUT_MS,
    onTimeout: () =>
      AppLogger.create("prayertimes").w(
        "Settings",
        "provider settings hydration timed out — deferring the reapply to the next launch"
      ),
  });

  return useProviderSettingsStore.getState().pendingReapply;
};

export default useProviderSettingsStore;
