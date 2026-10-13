// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

export const useAladhanSettings = () => {
  const currentProviderId = useProviderSettingsStore((state) => state.currentProviderId);
  const updateCurrentSettings = useProviderSettingsStore((state) => state.updateCurrentSettings);

  // Must be a selector: React Compiler freezes values read through the store's own
  // getters, whose identity never changes.
  // The editor shows the draft; the applied settings change only on Apply.
  const settings = useProviderSettingsStore(
    (state) => state.draft ?? state.allSettings[state.currentProviderId]
  );

  if (currentProviderId !== PRAYER_TIME_PROVIDERS.ALADHAN.id) {
    throw new Error("useAladhanSettings called when Aladhan is not the current provider");
  }

  return { settings, updateSettings: updateCurrentSettings };
};
