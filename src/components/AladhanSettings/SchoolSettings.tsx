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
import { AladhanMadhabId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

export const SchoolSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [, setIsChangingSchool] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schools = PRAYER_TIME_PROVIDERS.ALADHAN.schools;

  const schoolItems = useMemo(
    () =>
      schools.map((school) => ({
        label: t(`providers.aladhan.schools.${school.nameKey}`),
        value: school.id.toString(),
      })),
    [schools, t]
  );

  const handleSchoolChange = async (schoolId: string) => {
    hapticSelection();
    try {
      setError(null);
      setIsChangingSchool(true);
      const id = parseInt(schoolId, 10);
      if (schools.some((school) => school.id === id)) {
        await updateSettings({ madhab: id as AladhanMadhabId });
      }
    } catch (err) {
      setError(t("errors.failedToChangeSchool"));
      console.error("Error changing school:", err);
    } finally {
      setIsChangingSchool(false);
    }
  };

  if (!settings) return null;

  if (isLoading) {
    return (
      <Box marginTop="$6">
        <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.aladhan.school.title")}
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
        {t("providers.aladhan.school.title")}
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
        selectedValue={settings.madhab !== undefined ? settings.madhab.toString() : ""}
        onValueChange={handleSchoolChange}
        items={schoolItems}
        placeholder={t("providers.aladhan.school.selectPlaceholder")}
      />
    </Box>
  );
};

export default SchoolSettings;
