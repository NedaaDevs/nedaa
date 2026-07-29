import { FC, useMemo } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";
import { useAladhanSettings } from "@/hooks/useProviderSettings";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";

import { SettingSection } from "@/components/AladhanSettings/SettingSection";
import { TuningSettings } from "@/components/AladhanSettings/TuningSettings";

// Config
import { buildAladhanSections } from "@/components/AladhanSettings/sections";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

const AladhanSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { isLoading } = useProviderSettingsStore();
  const { settings, updateSettings } = useAladhanSettings();

  const sections = useMemo(
    () => (settings ? buildAladhanSections(settings, t) : []),
    [settings, t]
  );

  return (
    <Box marginHorizontal="$4" marginTop="$2">
      {/* One skeleton for the whole form; the sections load together. */}
      {isLoading ? (
        <Box marginTop="$6" testID="settings-form-skeleton">
          <Card padding="$6" alignItems="center">
            <Spinner size="small" />
            <Text fontSize="$2" color="$typographySecondary" marginTop="$3">
              {t("common.loading")}
            </Text>
          </Card>
        </Box>
      ) : (
        sections.map((section) => (
          <SettingSection
            key={section.key}
            section={section}
            onChange={(value) => {
              hapticSelection();
              const patch = section.apply(value);
              if (patch) updateSettings(patch);
            }}
          />
        ))
      )}

      <TuningSettings />
    </Box>
  );
};

export default AladhanSettings;
