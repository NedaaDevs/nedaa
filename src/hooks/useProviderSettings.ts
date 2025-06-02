// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
// Types
import { AladhanSettings } from "@/types/providers/aladhan";

export const useAladhanSettings = () => {
  const { isModified, currentProviderId, updateCurrentSettings, getCurrentSettings } =
    useProviderSettingsStore();

  if (currentProviderId !== PRAYER_TIME_PROVIDERS.ALADHAN.id) {
    throw new Error("useAladhanSettings called when Aladhan is not the current provider");
  }

  const settings = getCurrentSettings<AladhanSettings>();

  return {
    settings,
    updateSettings: (updates: Partial<AladhanSettings>) => updateCurrentSettings(updates),
    isModified,
  };
};
