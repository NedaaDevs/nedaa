// Constants
import { PRAYER_TIME_PROVIDERS, ProviderKey } from "@/constants/providers";

// Types
import type { AladhanApiParams } from "@/types/providers/aladhan";

// Utils
import { transformAladhanParams } from "@/utils/providers/aladhan";

export const providerAdapters = {
  ALADHAN: {
    toParams: (yearOverride?: number, month?: number): AladhanApiParams =>
      transformAladhanParams(yearOverride, month),
  },
} as const;

export const getAdapterByProviderId = (providerId: string) => {
  const providerKey = Object.entries(PRAYER_TIME_PROVIDERS).find(
    ([_, provider]) => provider.id === providerId
  )?.[0] as ProviderKey | undefined;

  if (!providerKey || !providerAdapters[providerKey]) {
    throw new Error(`No adapter found for provider ID: ${providerId}`);
  }

  return providerAdapters[providerKey];
};

export type ProviderAdapter = (typeof providerAdapters)[keyof typeof providerAdapters];
