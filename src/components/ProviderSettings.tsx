import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Store
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";

import { ProviderList } from "@/components/ProviderList";
import AladhanSettings from "@/components/AladhanSettings";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("prayertimes");

export const ProviderSettings: FC = () => {
  const { t } = useTranslation();
  const { isGettingProviders, providers, getProviders } = usePrayerTimesStore();
  const { currentProviderId } = useProviderSettingsStore();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setError(null);
        await getProviders();
      } catch (err) {
        setError(t("errors.failedToLoadProviders"));
        log.e("Providers", "loading providers failed", err instanceof Error ? err : undefined);
      }
    };
    fetchProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle retry on error
  const handleRetry = () => {
    getProviders().catch((err) => {
      setError(t("errors.failedToLoadProviders"));
      log.e("Providers", "retrying provider load failed", err instanceof Error ? err : undefined);
    });
  };

  if (isGettingProviders) {
    return (
      <Box alignItems="center" justifyContent="center" marginVertical="auto">
        <Spinner color="$accentPrimary" size="large" />
        <Text color="$typography">{t("common.loading")}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box alignItems="center" justifyContent="center" marginVertical="auto">
        <Pressable
          onPress={handleRetry}
          minHeight={44}
          minWidth={44}
          alignItems="center"
          justifyContent="center"
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}>
          <Text color="$typography">{t("common.retry")}</Text>
        </Pressable>
      </Box>
    );
  }

  // Render provider-specific settings based on currentProviderId
  const renderProviderSettings = () => {
    switch (currentProviderId) {
      case PRAYER_TIME_PROVIDERS.ALADHAN.id:
        return <AladhanSettings />;
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* A one-option chooser is noise; the picker earns its place at two providers. */}
      {providers.length > 1 && <ProviderList />}
      {renderProviderSettings()}
    </Box>
  );
};

export default ProviderSettings;
