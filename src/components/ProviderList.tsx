import React, { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

export const ProviderList: FC = () => {
  const { t } = useTranslation();
  const { isGettingProviders, providers, selectedProvider } = usePrayerTimesStore();
  const hapticSelection = useHaptic("selection");

  const providerItems = useMemo(
    () =>
      providers.map((provider) => ({
        label: provider.name,
        value: provider.id,
      })),
    [providers]
  );

  // Selection is not wired to a store yet, so the picker is display-only. It stays
  // hidden until a second provider exists (ProviderSettings gates on that).
  const handleProviderChange = () => {
    hapticSelection();
  };

  if (isGettingProviders) {
    return (
      <Box marginHorizontal="$4" marginTop="$6">
        <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.title")}
        </Text>
        <Card padding="$6" alignItems="center">
          <Spinner size="small" />
          <Text size="sm" color="$typographySecondary" marginTop="$3">
            {t("common.loading")}
          </Text>
        </Card>
      </Box>
    );
  }

  if (providers.length === 0) {
    return (
      <Box marginHorizontal="$4" marginTop="$6">
        <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.title")}
        </Text>
        <Card padding="$6">
          <Text size="sm" color="$typographySecondary" textAlign="center">
            {t("providers.noProvidersAvailable")}
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box marginHorizontal="$4" marginTop="$6">
      <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
        {t("providers.title")}
      </Text>

      <Select
        selectedValue={(selectedProvider && selectedProvider.id) ?? undefined}
        onValueChange={handleProviderChange}
        items={providerItems}
        placeholder={t("providers.selectPlaceholder")}
      />
    </Box>
  );
};

export default ProviderList;
