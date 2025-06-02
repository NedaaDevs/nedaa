import React, { FC, useState } from "react";

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

import { ChevronDownIcon, CheckIcon } from "lucide-react-native";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

export const ProviderList: FC = () => {
  const { t } = useTranslation();
  const { isGettingProviders, providers, selectedProvider } = usePrayerTimesStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Box className="mt-4 px-4">
      <Text className="text-lg font-semibold mb-2">{t("providers.title")}</Text>

      <Select
        selectedValue={(selectedProvider && selectedProvider.id.toString()) ?? null}
        initialLabel={(selectedProvider && selectedProvider.name) ?? ""}
        isDisabled={isGettingProviders}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("settings.advance.provider.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-lg bg-white transition-all duration-200 ${
            isOpen ? "border-blue-500" : ""
          } active:bg-gray-50`}>
          <SelectInput
            className="flex-1 text-gray-800 text-base"
            placeholder={t("settings.advance.provider.selectPlaceholder")}
          />
          <SelectIcon
            className={`mr-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            as={ChevronDownIcon}
          />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>

            <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
              {providers.map((provider) => {
                const isSelected = selectedProvider?.id === provider.id;

                return (
                  <SelectItem
                    key={provider.id}
                    value={provider.id.toString()}
                    label={provider.name}
                    className={`px-4 border-b border-gray-100 bg-white active:bg-gray-50 transition-colors duration-200 rounded-lg ${
                      isSelected ? "bg-blue-50" : ""
                    }`}>
                    <Box className="flex-row items-center justify-between">
                      <Box className="flex-1">
                        <Text
                          className={`text-base font-semibold mb-1 ${
                            isSelected ? "text-blue-700" : "text-gray-800"
                          }`}>
                          {t(`providers.${provider.name.toLowerCase()}.title`)}
                        </Text>
                        <Text
                          size="xs"
                          className={`${
                            isSelected ? "text-blue-600" : "text-blue-500"
                          } transition-colors duration-200`}>
                          {provider.website}
                        </Text>
                      </Box>
                      {isSelected && <CheckIcon className="text-blue-600" size={20} />}
                    </Box>
                  </SelectItem>
                );
              })}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};
export default ProviderList;
