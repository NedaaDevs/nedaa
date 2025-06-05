import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMadhabId } from "@/types/providers/aladhan";

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

export const SchoolSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [isOpen, setIsOpen] = useState(false);

  const schools = PRAYER_TIME_PROVIDERS.ALADHAN.schools;

  // Find the selected school object
  const selectedSchoolObj = schools.find((school) => school.id === settings?.madhab);

  const handleSchoolChange = (schoolId: string) => {
    const id = parseInt(schoolId, 10);

    // type guard before updating
    if (schools.some((school) => school.id === id)) {
      updateSettings({ madhab: id as AladhanMadhabId });
    }
  };

  if (!settings) return null;

  return (
    <Box className="mt-4 px-4">
      <Text className="text-lg font-semibold mb-2 dark:text-white">
        {t("providers.aladhan.school.title")}
      </Text>

      <Select
        selectedValue={settings.madhab?.toString()}
        initialLabel={
          selectedSchoolObj ? t(`providers.aladhan.schools.${selectedSchoolObj.nameKey}`) : ""
        }
        isDisabled={isLoading}
        onValueChange={handleSchoolChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("providers.aladhan.school.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-lg bg-white transition-all duration-200 ${
            isOpen ? "border-blue-500" : ""
          } active:bg-gray-50`}>
          <SelectInput placeholder={t("providers.aladhan.school.selectPlaceholder")} />
          <SelectIcon className="mr-3" as={ChevronDownIcon} />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>

            <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
              {schools.map((school) => {
                const isSelected = settings.madhab === school.id;

                return (
                  <SelectItem
                    key={school.id}
                    value={school.id.toString()}
                    label={t(`providers.aladhan.schools.${school.nameKey}`)}
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

export default SchoolSettings;
