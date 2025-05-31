import { FC } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMethodId } from "@/types/providers/aladhan";

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

const MethodSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const methods = PRAYER_TIME_PROVIDERS.ALADHAN.methods;

  // Find the selected method object
  const selectedMethodObj = methods.find((method) => method.id === settings?.method);

  const handleMethodChange = (methodId: string) => {
    const id = parseInt(methodId, 10);

    // type guard before updating
    if (methods.some((method) => method.id === id)) {
      updateSettings({ method: id as AladhanMethodId });
    }
  };

  if (!settings) return null;

  return (
    <Box className="mt-4 px-4">
      <Text className="text-lg font-semibold mb-2">{t("providers.aladhan.method.title")}</Text>
      <Select
        selectedValue={settings.method?.toString()}
        initialLabel={
          selectedMethodObj ? t(`providers.aladhan.methods.${selectedMethodObj.nameKey}`) : ""
        }
        isDisabled={isLoading}
        onValueChange={handleMethodChange}
        accessibilityLabel={t("providers.aladhan.method.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className="rounded-lg bg-white shadow-sm active:bg-gray-50">
          <SelectInput placeholder={t("providers.aladhan.method.selectPlaceholder")} />
          <SelectIcon className="mr-3" as={ChevronDownIcon} />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 py-2 border-b border-gray-100 shadow-sm mb-2">
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
              {methods.map((method) => (
                <SelectItem
                  key={method.id}
                  value={method.id.toString()}
                  label={t(`providers.aladhan.methods.${method.nameKey}`)}
                  className="px-4 py-3 mb-2 rounded-md border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 active:bg-gray-100 transition-all duration-200 ease-in-out">
                  <Text className="text-base">
                    {t(`providers.aladhan.methods.${method.nameKey}`)}
                  </Text>
                </SelectItem>
              ))}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};

export default MethodSettings;
