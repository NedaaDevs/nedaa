import React, { FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Select } from "@/components/ui/select";
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

  const [, setIsChangingProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerItems = useMemo(
    () =>
      providers.map((provider) => ({
        label: provider.name,
        value: provider.id,
      })),
    [providers]
  );

  const handleProviderChange = async (providerId: string) => {
    hapticSelection();
    try {
      setError(null);
      setIsChangingProvider(true);
    } catch (err) {
      setError(t("errors.failedToChangeProvider"));
      console.error("Error changing provider:", err);
    } finally {
      setIsChangingProvider(false);
    }
  };

  if (isGettingProviders) {
    return (
      <Box marginHorizontal="$4" marginTop="$6">
        <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.title")}
        </Text>
        <Box
          backgroundColor="$backgroundSecondary"
          borderRadius="$6"
          padding="$6"
          alignItems="center">
          <Spinner size="small" />
          <Text size="sm" color="$typographySecondary" marginTop="$3">
            {t("common.loading")}
          </Text>
        </Box>
      </Box>
    );
  }

  if (providers.length === 0) {
    return (
      <Box marginHorizontal="$4" marginTop="$6">
        <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.title")}
        </Text>
        <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$6">
          <Text size="sm" color="$typographySecondary" textAlign="center">
            {t("providers.noProvidersAvailable")}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box marginHorizontal="$4" marginTop="$6">
      <Text size="lg" fontWeight="600" marginBottom="$4" color="$typography">
        {t("providers.title")}
      </Text>

      {error && (
        <Box
          backgroundColor="$backgroundSecondary"
          borderRadius="$4"
          padding="$3"
          marginBottom="$4"
          borderWidth={1}
          borderColor="$error">
          <Text size="sm" color="$error">
            {error}
          </Text>
        </Box>
      )}

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
