import { FC, useState, useMemo, useEffect } from "react";
import { InteractionManager } from "react-native";
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
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Select } from "@/components/ui/select";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Center } from "@/components/ui/center";

// Icons
import { XIcon, ChevronDownIcon } from "lucide-react-native";

// Constants
const adjustmentValues: number[] = [
  ...Array.from({ length: 30 }, (_, i) => 30 - i),
  0,
  ...Array.from({ length: 30 }, (_, i) => -(i + 1)),
];

export const TuningSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [showModal, setShowModal] = useState(false);
  const [modalReady, setModalReady] = useState(false);

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

  const adjustmentItems = useMemo(
    () =>
      adjustmentValues.map((adjustValue) => ({
        label: `${adjustValue > 0 ? "+" : adjustValue < 0 ? "-" : ""}${t("common.minute", { count: Math.abs(adjustValue) })}`,
        value: adjustValue.toString(),
      })),
    [t]
  );

  const getCurrentTuning = (): AladhanTuning => {
    return settings?.tune || PRAYER_TIME_PROVIDERS.ALADHAN.tuning;
  };

  const updateTuning = (prayerTime: AladhanPrayerTimeName, value: number) => {
    const currentTuning = getCurrentTuning();
    const clampedValue = Math.max(-30, Math.min(30, value));

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
    setModalReady(false);
    setShowModal(true);
  };

  useEffect(() => {
    if (showModal) {
      const handle = InteractionManager.runAfterInteractions(() => {
        setModalReady(true);
      });
      return () => handle.cancel();
    }
  }, [showModal]);

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
      <Box marginTop="$6">
        <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.aladhan.tuning.title")}
        </Text>

        {/* Input-like button to open tuning modal */}
        <Box backgroundColor="$backgroundSecondary" borderRadius="$6">
          <Pressable
            onPress={openTuningModal}
            disabled={isLoading}
            paddingVertical="$4"
            paddingHorizontal="$5"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            minHeight={44}
            accessibilityLabel={t("providers.aladhan.tuning.title")}>
            <VStack flex={1}>
              <Text fontSize="$2" color="$typographySecondary">
                {t("providers.aladhan.tuning.inputLabel")}
              </Text>
              <Text fontSize="$4" fontWeight="500" color="$typography">
                {getSummaryText()}
              </Text>
            </VStack>

            <Icon as={ChevronDownIcon} size={16} color="$accentPrimary" />
          </Pressable>
        </Box>
      </Box>

      {/* Tuning Modal */}
      <Modal isOpen={showModal} onClose={closeModal} size="full">
        <ModalBackdrop />
        <ModalContent>
          <ModalCloseButton onPress={closeModal}>
            <Icon as={XIcon} size={20} color="$typographySecondary" />
          </ModalCloseButton>

          <ModalHeader>
            <Text fontSize="$5" fontWeight="600" color="$typography">
              {t("providers.aladhan.tuning.title")}
            </Text>
          </ModalHeader>

          <ModalBody>
            {!modalReady ? (
              <Center paddingVertical="$8">
                <Spinner size="small" />
              </Center>
            ) : (
              <Box paddingVertical="$4">
                <Text fontSize="$2" color="$typographySecondary" marginBottom="$4">
                  {t("providers.aladhan.tuning.description")}
                </Text>

                <VStack gap="$4">
                  {prayerTimes.map((prayerTime) => {
                    const value = currentTuning[prayerTime];

                    return (
                      <HStack key={prayerTime} justifyContent="space-between" alignItems="center">
                        <Text fontSize="$3" fontWeight="500" color="$typography" flex={1}>
                          {getPrayerDisplayName(prayerTime)}
                        </Text>

                        <Box width={140}>
                          <Select
                            selectedValue={value.toString()}
                            onValueChange={(selectedValue) =>
                              handlePrayerValueChange(prayerTime, selectedValue)
                            }
                            items={adjustmentItems}
                            placeholder={t("providers.aladhan.tuning.selectValue")}
                            disabled={isLoading}
                          />
                        </Box>
                      </HStack>
                    );
                  })}
                </VStack>

                {hasAnyAdjustments && (
                  <Button
                    variant="outline"
                    onPress={resetAllTuning}
                    disabled={isLoading}
                    marginTop="$4"
                    alignSelf="center"
                    backgroundColor="$background"
                    borderWidth={0}>
                    <Button.Text color="$typography">
                      {t("providers.aladhan.tuning.resetAll")}
                    </Button.Text>
                  </Button>
                )}
              </Box>
            )}
          </ModalBody>

          <ModalFooter>
            <Button onPress={closeModal} width="100%" backgroundColor="$accentPrimary">
              <Button.Text color="$typographyContrast">{t("common.done")}</Button.Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default TuningSettings;
