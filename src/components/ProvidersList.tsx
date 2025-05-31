import { useTranslation } from "react-i18next";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

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
import { ChevronDownIcon, CheckIcon } from "@/components/ui/icon";

const ProvidersList = () => {
  const { selectedProvider, providers, isGettingProviders } = usePrayerTimesStore();

  const { t } = useTranslation();

  return (
    <Box className="mt-4 px-4">
      <Text className="text-lg font-semibold mb-2">{t("providers.title")}</Text>

      <Select
        selectedValue={(selectedProvider && selectedProvider.id.toString()) ?? null}
        initialLabel={(selectedProvider && selectedProvider.name) ?? ""}
        isDisabled={isGettingProviders}
        accessibilityLabel={t("settings.advance.provider.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className="rounded-lg bg-white shadow-sm active:bg-gray-50">
          <SelectInput
            className="flex-1 text-gray-800 text-base"
            placeholder={t("settings.advance.provider.selectPlaceholder")}
          />
          <SelectIcon className="mr-3" as={ChevronDownIcon} />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
              {providers.map((provider) => {
                return (
                  <SelectItem
                    key={provider.id}
                    value={provider.id.toString()}
                    label={provider.name}
                    className="px-4 border-b border-gray-100 bg-white active:bg-gray-50 transition-colors duration-200 rounded-lg">
                    <Box className="flex-row items-center justify-between">
                      <Box className="flex-1">
                        <Text className="text-base font-semibold mb-1 text-gray-800">
                          {t(`providers.${provider.name.toLowerCase()}.title`)}
                        </Text>
                        <Text size="xs" className="text-blue-500 transition-colors duration-200">
                          {provider.website}
                        </Text>
                      </Box>
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

export default ProvidersList;
