// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMethodId } from "@/types/providers/aladhan";

/**
 * Provider names from the PRAYER_TIME_PROVIDERS constant
 * @see PRAYER_TIME_PROVIDERS
 */
export type ProviderName = keyof typeof PRAYER_TIME_PROVIDERS;

/**
 * Aladhan-specific provider settings
 * @see https://aladhan.com/calculation-methods
 */
export type AladhanSettings = {
  /** Calculation method ID */
  method: AladhanMethodId;
  // TODO: Add the rest of the options
};

/**
 * Maps provider names to their specific settings
 */
export type ProviderSettingsMap = {
  /** @see AladhanSettings */
  ALADHAN: AladhanSettings;
  // Add other providers here
};

/**
 * Provider settings store state
 */
export interface ProviderSettingsState {
  /** Currently selected provider */
  selectedProvider: ProviderName;
  /** Current provider settings */
  settings: AladhanSettings; // For now, just Aladhan settings
  /** Whether there are unsaved changes(mainly to reduce UI renders and api calls with every change) */
  isModified: boolean;
  isLoading: boolean;
  /** Error message if save failed */
  error: string | null;
}

/**
 * Prayer time calculation parameters
 * Used when making API requests
 */
export type PrayerTimeParams = {
  /** Calculation method ID */
  method: number;
};
