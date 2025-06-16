import React, { FC, useState, useMemo } from "react";
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

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

export const ProviderList: FC = () => {
  const { t } = useTranslation();
  const { isGettingProviders, providers, selectedProvider } = usePrayerTimesStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isChangingProvider, setIsChangingProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize provider list to prevent unnecessary re-renders
  const providerItems = useMemo(
    () =>
      providers.map((provider) => {
        const isSelected = selectedProvider?.id === provider.id;

        return (
          <SelectItem
            key={provider.id}
            value={provider.id.toString()}
            label={provider.name}
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
    [providers, selectedProvider, t]
  );

  const handleProviderChange = async (providerId: string) => {
    try {
      setError(null);
      setIsChangingProvider(true);
    } catch (err) {
      setError(t("errors.failedToChangeProvider"));
      console.error("Error changing provider:", err);
    } finally {
      setIsChangingProvider(false);
    }
  };

  if (isGettingProviders) {
    return (
      <Box className="mx-4 mt-6">
        <Text className="text-lg font-semibold mb-4 text-typography">{t("providers.title")}</Text>
        <Box className="bg-background-secondary rounded-xl p-6 items-center">
          <Spinner size="small" />
          <Text className="text-sm text-typography-secondary mt-3">{t("common.loading")}</Text>
        </Box>
      </Box>
    );
  }

  if (providers.length === 0) {
    return (
      <Box className="mx-4 mt-6">
        <Text className="text-lg font-semibold mb-4 text-typography">{t("providers.title")}</Text>
        <Box className="bg-background-secondary rounded-xl p-6">
          <Text className="text-sm text-typography-secondary text-center">
            {t("providers.noProvidersAvailable")}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mx-4 mt-6">
      <Text className="text-lg font-semibold mb-4 text-typography">{t("providers.title")}</Text>

      {error && (
        <Box className="bg-background-error rounded-lg p-3 mb-4 border border-border-error">
          <Text className="text-sm text-error">{error}</Text>
        </Box>
      )}

      <Select
        selectedValue={(selectedProvider && selectedProvider.id.toString()) ?? null}
        initialLabel={(selectedProvider && selectedProvider.name) ?? ""}
        isDisabled={isGettingProviders || isChangingProvider}
        onValueChange={handleProviderChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accessibilityLabel={t("providers.selectPlaceholder")}>
        <SelectTrigger
          variant="outline"
          size="lg"
          className={`rounded-xl bg-background-secondary transition-all duration-200 border-0 ${isOpen ? "border-primary" : "border-outline"} ${isChangingProvider ? "opacity-70" : ""}`}>
          <SelectInput
            className="flex-1 text-typography text-base font-medium px-2"
            placeholder={t("providers.selectPlaceholder")}
          />
          <SelectIcon
            className="mr-3 text-primary"
            as={isChangingProvider ? Spinner : ChevronDownIcon}
          />
        </SelectTrigger>

        <SelectPortal>
          <SelectBackdrop />
          <SelectContent className="bg-background-secondary rounded-t-3xl">
            <SelectDragIndicatorWrapper className="py-3">
              <SelectDragIndicator className="bg-typography-secondary w-12 h-1 rounded-full" />
            </SelectDragIndicatorWrapper>

            <SelectScrollView className="px-2 pb-6 max-h-screen">
              <Text className="text-lg font-semibold text-typography mx-2 mb-3">
                {t("providers.selectProvider")}
              </Text>
              {providerItems}
            </SelectScrollView>
          </SelectContent>
        </SelectPortal>
      </Select>
    </Box>
  );
};

export default ProviderList;
