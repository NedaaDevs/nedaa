// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
// Types
import { AladhanSettings } from "@/types/providers/aladhan";

export const useAladhanSettings = () => {
  const currentProviderId = useProviderSettingsStore((state) => state.currentProviderId);
  const isModified = useProviderSettingsStore((state) => state.isModified);
  const updateCurrentSettings = useProviderSettingsStore((state) => state.updateCurrentSettings);

  // Must be a selector: React Compiler freezes values read through the store's own
  // getters, whose identity never changes.
  const settings = useProviderSettingsStore(
    (state) => state.allSettings[state.currentProviderId]
  ) as AladhanSettings | undefined;

  if (currentProviderId !== PRAYER_TIME_PROVIDERS.ALADHAN.id) {
    throw new Error("useAladhanSettings called when Aladhan is not the current provider");
  }

  return {
    settings,
    updateSettings: (updates: Partial<AladhanSettings>) => updateCurrentSettings(updates),
    isModified,
  };
};
