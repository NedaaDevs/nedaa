import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMidnightModeId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

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
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

// Icons
import { ChevronDownIcon } from "@/components/ui/icon";

export const MidnightModeSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [isOpen, setIsOpen] = useState(false);

  const midnightModes = PRAYER_TIME_PROVIDERS.ALADHAN.midnightModes;

  // Find the selected midnight mode object
  const selectedMidnightModeObj = midnightModes.find((mode) => mode.id === settings?.midnightMode);

  const handleMidnightModeChange = (modeId: string) => {
    const id = parseInt(modeId, 10);

    // type guard before updating
    if (midnightModes.some((mode) => mode.id === id)) {
      updateSettings({ midnightMode: id as AladhanMidnightModeId });
    }
  };

  if (!settings) return null;

  return (
    <Box className="mt-4 px-4">
      <Text className="text-lg font-semibold mb-2 dark:text-white">
        {t("providers.aladhan.midnightMode.title")}
      </Text>

      <Select
        selectedValue={settings.midnightMode?.toString()}
        initialLabel={
          selectedMidnightModeObj
            ? t(`providers.aladhan.midnightModes.${selectedMidnightModeObj.nameKey}`)
            : ""
        }
        isDisabled={isLoading}
        onValueChange={handleMidnightModeChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("providers.aladhan.midnightMode.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-lg bg-white transition-all duration-200 ${
            isOpen ? "border-blue-500" : ""
          } active:bg-gray-50`}>
          <SelectInput placeholder={t("providers.aladhan.midnightMode.selectPlaceholder")} />
          <SelectIcon className="mr-3" as={ChevronDownIcon} />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>

            <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
              {midnightModes.map((mode) => {
                const isSelected = settings.midnightMode === mode.id;

                return (
                  <SelectItem
                    key={mode.id}
                    value={mode.id.toString()}
                    label={t(`providers.aladhan.midnightModes.${mode.nameKey}`)}
                    className={`px-4 py-3 mb-2 rounded-md border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 transition-all duration-200 ease-in-out ${
                      isSelected ? "bg-blue-50 border-blue-500" : ""
                    }`}
                  />
                );
              })}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};

export default MidnightModeSettings;
