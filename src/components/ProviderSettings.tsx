import { FC, useEffect, useState } from "react";
import { TouchableOpacity } from "react-native";
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

import ProviderList from "@/components/ProviderList";
import AladhanSettings from "@/components/AladhanSettings";

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
        console.error("Error fetching providers:", err);
      }
    };
    fetchProviders();
  }, []);

  // Handle retry on error
  const handleRetry = () => {
    getProviders().catch((err) => {
      setError(t("errors.failedToLoadProviders"));
      console.error("Error retrying provider fetch:", err);
    });
  };

  if (isGettingProviders) {
    return (
      <Box className="items-center justify-center my-auto">
        <Spinner color="#e5cb87" size="large" />
        <Text>{t("common.loading")}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="items-center justify-center my-auto">
        <TouchableOpacity onPress={handleRetry}>
          <Text>{t("common.retry")}</Text>
        </TouchableOpacity>
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
      {providers.length > 0 && <ProviderList />}
      {renderProviderSettings()}
    </Box>
  );
};

export default ProviderSettings;
