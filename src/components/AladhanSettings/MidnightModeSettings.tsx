import { FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Select } from "@/components/ui/select";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMidnightModeId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

export const MidnightModeSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [, setIsChangingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const midnightModes = PRAYER_TIME_PROVIDERS.ALADHAN.midnightModes;

  const modeItems = useMemo(
    () =>
      midnightModes.map((mode) => ({
        label: t(`providers.aladhan.midnightModes.${mode.nameKey}`),
        value: mode.id.toString(),
      })),
    [midnightModes, t]
  );

  const handleMidnightModeChange = async (modeId: string) => {
    hapticSelection();
    try {
      setError(null);
      setIsChangingMode(true);
      const id = parseInt(modeId, 10);
      if (midnightModes.some((mode) => mode.id === id)) {
        await updateSettings({ midnightMode: id as AladhanMidnightModeId });
      }
    } catch (err) {
      setError(t("errors.failedToChangeMidnightMode"));
      console.error("Error changing midnight mode:", err);
    } finally {
      setIsChangingMode(false);
    }
  };

  if (!settings) return null;

  if (isLoading) {
    return (
      <Box marginTop="$6">
        <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.aladhan.midnightMode.title")}
        </Text>
        <Box
          backgroundColor="$backgroundSecondary"
          borderRadius="$6"
          padding="$6"
          alignItems="center">
          <Spinner size="small" />
          <Text fontSize="$2" color="$typographySecondary" marginTop="$3">
            {t("common.loading")}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box marginTop="$6">
      <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
        {t("providers.aladhan.midnightMode.title")}
      </Text>

      {error && (
        <Box
          backgroundColor="$backgroundSecondary"
          borderRadius="$4"
          padding="$3"
          marginBottom="$4"
          borderWidth={1}
          borderColor="$error">
          <Text fontSize="$2" color="$error">
            {error}
          </Text>
        </Box>
      )}

      <Select
        selectedValue={settings.midnightMode !== undefined ? settings.midnightMode.toString() : ""}
        onValueChange={handleMidnightModeChange}
        items={modeItems}
        placeholder={t("providers.aladhan.midnightMode.selectPlaceholder")}
      />
    </Box>
  );
};

export default MidnightModeSettings;
