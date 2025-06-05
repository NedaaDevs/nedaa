import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import { AladhanTuning, AladhanPrayerTimeName } from "@/types/providers/aladhan";

// Hooks
import { useAladhanSettings } from "@/hooks/useProviderSettings";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Components
import { ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
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
import { Modal } from "@/components/ui/modal";

// Icons
import { XIcon, ChevronDownIcon } from "lucide-react-native";

export const TuningSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [showModal, setShowModal] = useState(false);

  // Prayer times in order
  const prayerTimes: AladhanPrayerTimeName[] = [
    "fajr",
    "sunrise",
    "dhuhr",
    "asr",
    "maghrib",
    "sunset",
    "isha",
    "midnight",
  ];

  // Generate all adjustment values from -60 to +60
  const adjustmentValues: number[] = [];
  for (let i = -60; i <= 60; i++) {
    adjustmentValues.push(i);
  }

  const getCurrentTuning = (): AladhanTuning => {
    return settings?.tune || PRAYER_TIME_PROVIDERS.ALADHAN.tuning;
  };

  const updateTuning = (prayerTime: AladhanPrayerTimeName, value: number) => {
    const currentTuning = getCurrentTuning();
    const clampedValue = Math.max(-60, Math.min(60, value));

    updateSettings({
      tune: {
        ...currentTuning,
        [prayerTime]: clampedValue,
      },
    });
  };

  const getPrayerDisplayName = (prayerTime: AladhanPrayerTimeName) => {
    // Map prayer times to correct translation keys
    const prayerNameMap: Record<AladhanPrayerTimeName, string> = {
      fajr: "prayerTimes.fajr",
      dhuhr: "prayerTimes.dhuhr",
      asr: "prayerTimes.asr",
      maghrib: "prayerTimes.maghrib",
      isha: "prayerTimes.isha",
      //  otherTimings
      sunrise: "otherTimings.sunrise",
      sunset: "otherTimings.sunset",
      midnight: "otherTimings.midnight",
      imsak: "otherTimings.imsak",
    };

    return t(prayerNameMap[prayerTime]);
  };

  const openTuningModal = () => {
    setShowModal(true);
  };

  const handlePrayerValueChange = (prayerTime: AladhanPrayerTimeName, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      updateTuning(prayerTime, numValue);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const resetAllTuning = () => {
    updateSettings({
      tune: { ...PRAYER_TIME_PROVIDERS.ALADHAN.tuning },
    });
  };

  if (!settings) return null;

  const currentTuning = getCurrentTuning();
  const hasAnyAdjustments = Object.values(currentTuning).some((value) => value !== 0);

  const getSummaryText = () => {
    if (!hasAnyAdjustments) {
      return t("providers.aladhan.tuning.noAdjustments");
    }

    const adjustedCount = Object.values(currentTuning).filter((value) => value !== 0).length;
    return t("providers.aladhan.tuning.adjustedCount", { count: adjustedCount });
  };

  return (
    <>
      <Box className="mt-4 px-4">
        <Text className="text-lg font-semibold mb-2 dark:text-white">
          {t("providers.aladhan.tuning.title")}
        </Text>

        {/* Input-like button to open tuning modal */}
        <Box className="bg-white dark:bg-gray-800 rounded-lg">
          <Pressable
            onPress={openTuningModal}
            disabled={isLoading}
            className="py-4 px-5 flex-row justify-between items-center">
            <VStack className="flex-1">
              <Text className="text-left text-sm text-gray-500 dark:text-gray-400">
                {t("providers.aladhan.tuning.inputLabel")}
              </Text>
              <Text className="text-left text-lg font-medium text-gray-900 dark:text-white">
                {getSummaryText()}
              </Text>
            </VStack>

            {/* Edit indicator */}
            <Box className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center">
              <ChevronDownIcon size={16} color="#6B7280" />
            </Box>
          </Pressable>
        </Box>
      </Box>

      {/* Tuning Modal */}
      <Modal isOpen={showModal} onClose={closeModal}>
        <Box className="flex-1 bg-transparent items-center justify-center p-4">
          <Box className="bg-white dark:bg-gray-800 rounded-t-xl max-h-[90%]">
            {/* Header */}
            <HStack className="justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("providers.aladhan.tuning.title")}
              </Text>
              <Pressable className="p-2 rounded-md" onPress={closeModal}>
                <XIcon size={24} color="#6B7280" />
              </Pressable>
            </HStack>

            {/* Content */}
            <ScrollView className="flex-1">
              <Box className="p-6">
                <Text className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  {t("providers.aladhan.tuning.description")}
                </Text>

                {/* Prayer time adjustments */}
                <VStack space="lg">
                  {prayerTimes.map((prayerTime) => {
                    const value = currentTuning[prayerTime];

                    return (
                      <Box key={prayerTime}>
                        <Text className="text-base font-medium text-gray-900 dark:text-white mb-2">
                          {getPrayerDisplayName(prayerTime)}
                        </Text>

                        <Select
                          selectedValue={value.toString()}
                          onValueChange={(selectedValue) =>
                            handlePrayerValueChange(prayerTime, selectedValue)
                          }
                          initialLabel={`${value > 0 ? "+" : ""}${t("common.minute", { count: Math.abs(value) })}`}
                          defaultValue={value.toString()}>
                          <SelectTrigger variant="outline" size="lg" className="w-full">
                            <SelectInput placeholder={t("providers.aladhan.tuning.selectValue")} />
                            <SelectIcon className="mr-3" as={ChevronDownIcon} />
                          </SelectTrigger>

                          <SelectPortal>
                            <SelectBackdrop />
                            <SelectContent>
                              <SelectDragIndicatorWrapper>
                                <SelectDragIndicator />
                              </SelectDragIndicatorWrapper>

                              <SelectScrollView
                                className="px-2 pt-1 pb-4 max-h-[60vh]"
                                contentOffset={{ y: Math.max(0, (value + 60) * 50 - 150), x: 0 }}>
                                {adjustmentValues.map((adjustValue) => {
                                  const isSelected = value === adjustValue;
                                  const isZero = adjustValue === 0;

                                  return (
                                    <SelectItem
                                      key={adjustValue}
                                      value={adjustValue.toString()}
                                      label={`${adjustValue > 0 ? "+" : ""}${t("common.minute", { count: Math.abs(adjustValue) })}`}
                                      className={`px-4 py-3 mb-1 rounded-md border transition-all ${
                                        isSelected
                                          ? "bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-400"
                                          : isZero
                                            ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-400"
                                            : "bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
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
                  })}
                </VStack>

                {/* Reset all button */}
                {hasAnyAdjustments && (
                  <Button
                    variant="outline"
                    onPress={resetAllTuning}
                    isDisabled={isLoading}
                    className="mt-6 self-center">
                    <ButtonText>{t("providers.aladhan.tuning.resetAll")}</ButtonText>
                  </Button>
                )}
              </Box>
            </ScrollView>

            {/* Footer */}
            <Box className="p-6 border-t border-gray-200 dark:border-gray-700">
              <Button onPress={closeModal} className="w-full">
                <ButtonText className="text-white">{t("common.done")}</ButtonText>
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default TuningSettings;
