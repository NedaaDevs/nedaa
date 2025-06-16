import { FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectScrollView,
  SelectItem,
} from "@/components/ui/select";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";

import { ChevronDownIcon, CheckIcon } from "lucide-react-native";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMidnightModeId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

export const MidnightModeSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const midnightModes = PRAYER_TIME_PROVIDERS.ALADHAN.midnightModes;

  const modeItems = useMemo(
    () =>
      midnightModes.map((mode) => {
        const isSelected = settings?.midnightMode === mode.id;

        return (
          <SelectItem
            key={mode.id}
            value={mode.id.toString()}
            label={t(`providers.aladhan.midnightModes.${mode.nameKey}`)}
            className={`mx-2 text-typography mb-2 rounded-xl overflow-hidden border-0 ${
              isSelected ? "bg-surface-active" : "bg-background-secondary"
            }`}>
            {isSelected && (
              <Box className="bg-primary rounded-full p-1.5">
                <CheckIcon
                  className="text-typography-contrast"
                  size={14}
                  accessibilityLabel={t("common.selected")}
                />
              </Box>
            )}
          </SelectItem>
        );
      }),
    [midnightModes, settings?.midnightMode, t]
  );

  const handleMidnightModeChange = async (modeId: string) => {
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
      <Box className="mx-4 mt-6">
        <Text className="text-lg font-semibold mb-4 text-typography">
          {t("providers.aladhan.midnightMode.title")}
        </Text>
        <Box className="bg-background-secondary rounded-xl p-6 items-center">
          <Spinner size="small" />
          <Text className="text-sm text-typography-secondary mt-3">{t("common.loading")}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mx-4 mt-6">
      <Text className="text-lg font-semibold mb-4 text-typography">
        {t("providers.aladhan.midnightMode.title")}
      </Text>

      {error && (
        <Box className="bg-background-error rounded-lg p-3 mb-4 border border-border-error">
          <Text className="text-sm text-error">{error}</Text>
        </Box>
      )}

      <Select
        selectedValue={settings.midnightMode !== undefined ? settings.midnightMode.toString() : ""}
        initialLabel={
          settings.midnightMode !== undefined
            ? t(
                `providers.aladhan.midnightModes.${midnightModes.find((m) => m.id === settings.midnightMode)?.nameKey}`
              )
            : ""
        }
        isDisabled={isLoading || isChangingMode}
        onValueChange={handleMidnightModeChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("providers.aladhan.midnightMode.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-xl bg-background-secondary transition-all duration-200 border-0 ${isOpen ? "border-accent-primary" : "border-outline"} ${isChangingMode ? "opacity-70" : ""}`}>
          <SelectInput
            className="flex-1 text-typography text-base font-medium px-2"
            placeholder={t("providers.aladhan.midnightMode.selectPlaceholder")}
          />
          <SelectIcon
            className="mr-3 text-accent-primary"
            as={isChangingMode ? Spinner : ChevronDownIcon}
          />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent className="bg-background-secondary rounded-t-3xl max-h-[80vh]">
            <SelectDragIndicatorWrapper className="py-3">
              <SelectDragIndicator className="bg-typography-secondary w-12 h-1 rounded-full" />
            </SelectDragIndicatorWrapper>

            <SelectScrollView className="px-2 pb-6 max-h-[50vh]">
              <Text className="text-lg font-semibold text-typography mx-2 mb-3">
                {t("providers.aladhan.midnightMode.selectMode")}
              </Text>
              {modeItems}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};

export default MidnightModeSettings;
