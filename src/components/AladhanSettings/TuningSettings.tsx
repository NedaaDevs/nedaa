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
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
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

import { TuningStepper } from "@/components/AladhanSettings/TuningStepper";

// Config
import {
  TUNED_PRAYERS,
  clampTuning,
  prayerNameKey,
  summariseTuning,
} from "@/components/AladhanSettings/tuning";

// Icons
import { XIcon, ChevronDownIcon } from "lucide-react-native";

export const TuningSettings: FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const { isLoading } = useProviderSettingsStore();

  const [showModal, setShowModal] = useState(false);

  const getCurrentTuning = (): AladhanTuning =>
    settings?.tune || PRAYER_TIME_PROVIDERS.ALADHAN.tuning;

  const updateTuning = (prayerTime: AladhanPrayerTimeName, value: number) => {
    updateSettings({
      tune: { ...getCurrentTuning(), [prayerTime]: clampTuning(value) },
    });
  };

  const resetAllTuning = () => {
    updateSettings({ tune: { ...PRAYER_TIME_PROVIDERS.ALADHAN.tuning } });
  };

  if (!settings) return null;

  const currentTuning = getCurrentTuning();
  const summary = summariseTuning(currentTuning, t);

  return (
    <>
      <Box marginTop="$6">
        <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
          {t("providers.aladhan.tuning.title")}
        </Text>

        <Card variant="grouped">
          <Pressable
            testID="tuning-open"
            onPress={() => setShowModal(true)}
            disabled={isLoading}
            paddingVertical="$4"
            paddingHorizontal="$5"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            minHeight={44}
            accessibilityRole="button"
            accessibilityLabel={t("providers.aladhan.tuning.title")}>
            <VStack flex={1}>
              <Text fontSize="$2" color="$typographySecondary">
                {t("providers.aladhan.tuning.inputLabel")}
              </Text>
              {/* Names the adjusted prayers rather than counting them. */}
              <Text fontSize="$4" fontWeight="500" color="$typography">
                {summary ?? t("providers.aladhan.tuning.noAdjustments")}
              </Text>
            </VStack>

            <Icon as={ChevronDownIcon} size={16} color="$accentPrimary" />
          </Pressable>
        </Card>
      </Box>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="full">
        <ModalBackdrop />
        <ModalContent>
          <ModalCloseButton onPress={() => setShowModal(false)}>
            <Icon as={XIcon} size={20} color="$typographySecondary" />
          </ModalCloseButton>

          <ModalHeader>
            <Text fontSize="$5" fontWeight="600" color="$typography">
              {t("providers.aladhan.tuning.title")}
            </Text>
          </ModalHeader>

          {/* Steppers render cheaply, so the body needs no deferral to open smoothly. */}
          <ModalBody>
            <Box paddingVertical="$4">
              <Text fontSize="$2" color="$typographySecondary" marginBottom="$4">
                {t("providers.aladhan.tuning.description")}
              </Text>

              <VStack gap="$2">
                {TUNED_PRAYERS.map((prayerTime) => (
                  <TuningStepper
                    key={prayerTime}
                    label={t(prayerNameKey(prayerTime))}
                    value={currentTuning[prayerTime] ?? 0}
                    onChange={(value) => updateTuning(prayerTime, value)}
                    disabled={isLoading}
                  />
                ))}
              </VStack>

              {summary && (
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
          </ModalBody>

          <ModalFooter>
            <Button
              onPress={() => setShowModal(false)}
              width="100%"
              backgroundColor="$accentPrimary">
              <Button.Text color="$typographyContrast">{t("common.done")}</Button.Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default TuningSettings;
