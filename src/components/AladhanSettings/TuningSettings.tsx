import { FC, useState, useMemo } from "react";
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
import { Spinner } from "@/components/ui/spinner";

// Constants
const adjustmentValues: number[] = Array.from({ length: 121 }, (_, i) => i - 60);

export const TuningSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [showModal, setShowModal] = useState(false);
  const [openSelects, setOpenSelects] = useState<Record<string, boolean>>({});

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

  const getAdjustmentItems = useMemo(() => {
    return (value: number, t: (key: string, options?: any) => string) => {
      return adjustmentValues.map((adjustValue) => {
        const isSelected = value === adjustValue;
        return (
          <SelectItem
            key={adjustValue}
            value={adjustValue.toString()}
            label={`${adjustValue > 0 ? "+" : adjustValue < 0 ? "-" : ""}${t("common.minute", { count: Math.abs(adjustValue) })}`}
            className={`mx-2 text-typography mb-2 rounded-xl overflow-hidden border-0 ${isSelected ? "bg-surface-active" : "bg-background-secondary"}`}
          />
        );
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]); // Only recreate if translation function changes

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
      <Box className="mx-4 mt-6">
        <Text className="text-lg font-semibold mb-4 text-typography">
          {t("providers.aladhan.tuning.title")}
        </Text>

        {/* Input-like button to open tuning modal */}
        <Box className="bg-background-secondary rounded-xl">
          <Pressable
            onPress={openTuningModal}
            disabled={isLoading}
            className="py-4 px-5 flex-row justify-between items-center">
            <VStack className="flex-1">
              <Text className="text-left text-sm text-typography-secondary">
                {t("providers.aladhan.tuning.inputLabel")}
              </Text>
              <Text className="text-left text-lg font-medium text-typography">
                {getSummaryText()}
              </Text>
            </VStack>

            {/* Edit indicator */}
            <Box className="w-6 h-6 rounded-full items-center justify-center">
              <ChevronDownIcon size={16} className="text-accent-primary" />
            </Box>
          </Pressable>
        </Box>
      </Box>

      {/* Tuning Modal */}
      <Modal isOpen={showModal} onClose={closeModal}>
        <Box className="flex-1 bg-transparent items-center justify-end p-4">
          <Box className="bg-background-secondary rounded-t-3xl w-full max-h-[85vh] min-h-[70vh]">
            {/* Header */}
            <HStack className="justify-between items-center p-6 border-b border-outline">
              <Text className="text-xl font-semibold text-typography">
                {t("providers.aladhan.tuning.title")}
              </Text>
              <Pressable className="p-2 rounded-md" onPress={closeModal}>
                <XIcon size={24} className="text-typography-secondary" />
              </Pressable>
            </HStack>

            {/* Content */}
            <ScrollView className="flex-1 px-6">
              <Box className="py-6">
                <Text className="text-sm text-typography-secondary mb-6">
                  {t("providers.aladhan.tuning.description")}
                </Text>

                {/* Prayer time adjustments */}
                <VStack space="lg">
                  {prayerTimes.map((prayerTime) => {
                    const value = currentTuning[prayerTime];

                    return (
                      <HStack key={prayerTime} className="justify-between items-center">
                        <Text className="text-base font-medium text-typography flex-1">
                          {getPrayerDisplayName(prayerTime)}
                        </Text>

                        <Box className="w-32">
                          <Select
                            key={`${prayerTime}-${value}`}
                            selectedValue={value.toString()}
                            onValueChange={(selectedValue) =>
                              handlePrayerValueChange(prayerTime, selectedValue)
                            }
                            onOpen={() =>
                              setOpenSelects((prev) => ({ ...prev, [prayerTime]: true }))
                            }
                            onClose={() =>
                              setOpenSelects((prev) => ({ ...prev, [prayerTime]: false }))
                            }
                            initialLabel={`${value > 0 ? "+" : value < 0 ? "-" : ""}${t("common.minute", { count: Math.abs(value) })}`}
                            defaultValue={value.toString()}>
                            <SelectTrigger
                              variant="outline"
                              size="lg"
                              className={`rounded-xl bg-background-secondary transition-all duration-200 border-0 ${openSelects[prayerTime] ? "border-accent-primary" : "border-outline"} ${isLoading ? "opacity-70" : ""}`}>
                              <SelectInput
                                className="text-left !text-typography font-medium"
                                placeholder={t("providers.aladhan.tuning.selectValue")}
                              />
                              <SelectIcon
                                className="mr-3 text-accent-primary"
                                as={isLoading ? Spinner : ChevronDownIcon}
                              />
                            </SelectTrigger>

                            <SelectPortal>
                              <SelectBackdrop />
                              <SelectContent className="bg-background-secondary rounded-t-3xl max-h-[80vh]">
                                <SelectDragIndicatorWrapper className="py-3">
                                  <SelectDragIndicator className="bg-typography-secondary w-12 h-1 rounded-full" />
                                </SelectDragIndicatorWrapper>

                                <SelectScrollView
                                  className="px-2 pb-6 max-h-[50vh]"
                                  contentOffset={{ y: Math.max(0, (value + 60) * 50 - 150), x: 0 }}>
                                  <Text className="text-lg font-semibold text-typography mx-2 mb-3">
                                    {t("providers.aladhan.tuning.selectValue")}
                                  </Text>
                                  {getAdjustmentItems(value, t)}
                                </SelectScrollView>
                              </SelectContent>
                            </SelectPortal>
                          </Select>
                        </Box>
                      </HStack>
                    );
                  })}
                </VStack>

                {/* Reset all button */}
                {hasAnyAdjustments && (
                  <Button
                    variant="outline"
                    onPress={resetAllTuning}
                    isDisabled={isLoading}
                    className="mt-6 self-center bg-background border-0">
                    <ButtonText className="text-typography">
                      {t("providers.aladhan.tuning.resetAll")}
                    </ButtonText>
                  </Button>
                )}
              </Box>
            </ScrollView>

            {/* Footer */}
            <Box className="p-6 border-t border-outline">
              <Button onPress={closeModal} className="w-full bg-accent-primary">
                <ButtonText className="text-background">{t("common.done")}</ButtonText>
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default TuningSettings;
