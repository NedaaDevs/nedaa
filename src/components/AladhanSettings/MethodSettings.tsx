import { FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMethodId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("prayertimes");

export const MethodSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [error, setError] = useState<string | null>(null);

  const methods = PRAYER_TIME_PROVIDERS.ALADHAN.methods;

  const methodItems = useMemo(
    () =>
      methods.map((method) => ({
        label: t(`providers.aladhan.methods.${method.nameKey}`),
        value: method.id.toString(),
      })),
    [methods, t]
  );

  const handleMethodChange = async (methodId: string) => {
    hapticSelection();
    try {
      setError(null);
      const id = parseInt(methodId, 10);
      if (methods.some((method) => method.id === id)) {
        await updateSettings({ method: id as AladhanMethodId });
      }
    } catch (err) {
      setError(t("errors.failedToChangeMethod"));
      log.e("Method", "changing calculation method failed", err instanceof Error ? err : undefined);
    }
  };

  if (!settings) return null;

  if (isLoading) {
    return (
      <Box marginTop="$6">
        <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.aladhan.method.title")}
        </Text>
        <Card padding="$6" alignItems="center">
          <Spinner size="small" />
          <Text fontSize="$2" color="$typographySecondary" marginTop="$3">
            {t("common.loading")}
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box marginTop="$6">
      <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
        {t("providers.aladhan.method.title")}
      </Text>

      {error && (
        <Card padding="$3" marginBottom="$4" borderWidth={1} borderColor="$error">
          <Text fontSize="$2" color="$error">
            {error}
          </Text>
        </Card>
      )}

      <Select
        selectedValue={settings.method?.toString()}
        onValueChange={handleMethodChange}
        items={methodItems}
        placeholder={t("providers.aladhan.method.selectPlaceholder")}
      />
    </Box>
  );
};

export default MethodSettings;
