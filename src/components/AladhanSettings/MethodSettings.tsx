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

import { ChevronDownIcon } from "lucide-react-native";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanMethodId } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

export const MethodSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isChangingMethod, setIsChangingMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = PRAYER_TIME_PROVIDERS.ALADHAN.methods;

  const methodItems = useMemo(
    () =>
      methods.map((method) => {
        const isSelected = settings?.method === method.id;

        return (
          <SelectItem
            key={method.id}
            value={method.id.toString()}
            label={t(`providers.aladhan.methods.${method.nameKey}`)}
            className={`mx-2 text-typography mb-2 rounded-xl overflow-hidden border-0 ${
              isSelected ? "bg-surface-active" : "bg-background-secondary"
            }`}
          />
        );
      }),
    [methods, settings?.method, t]
  );

  const handleMethodChange = async (methodId: string) => {
    hapticSelection();
    try {
      setError(null);
      setIsChangingMethod(true);
      const id = parseInt(methodId, 10);
      if (methods.some((method) => method.id === id)) {
        await updateSettings({ method: id as AladhanMethodId });
      }
    } catch (err) {
      setError(t("errors.failedToChangeMethod"));
      console.error("Error changing method:", err);
    } finally {
      setIsChangingMethod(false);
    }
  };

  if (!settings) return null;

  if (isLoading) {
    return (
      <Box className="mx-4 mt-6">
        <Text className="text-lg font-semibold mb-4 text-typography">
          {t("providers.aladhan.method.title")}
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
        {t("providers.aladhan.method.title")}
      </Text>

      {error && (
        <Box className="bg-background-error rounded-lg p-3 mb-4 border border-border-error">
          <Text className="text-sm text-error">{error}</Text>
        </Box>
      )}

      <Select
        selectedValue={settings.method?.toString()}
        initialLabel={
          settings.method
            ? t(
                `providers.aladhan.methods.${methods.find((m) => m.id === settings.method)?.nameKey}`
              )
            : ""
        }
        isDisabled={isLoading || isChangingMethod}
        onValueChange={handleMethodChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("providers.aladhan.method.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-xl bg-background-secondary transition-all duration-200 border-0 ${isOpen ? "border-accent-primary" : "border-outline"} ${isChangingMethod ? "opacity-70" : ""}`}>
          <SelectInput
            className="text-left !text-typography font-medium"
            placeholder={t("providers.aladhan.method.selectPlaceholder")}
          />
          <SelectIcon
            className="mr-3 text-accent-primary"
            as={isChangingMethod ? Spinner : ChevronDownIcon}
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
                {t("providers.aladhan.method.selectMethod")}
              </Text>
              {methodItems}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};

export default MethodSettings;
