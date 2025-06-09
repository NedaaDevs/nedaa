import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
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

// Icons
import { X, ChevronDown } from "lucide-react-native";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";

// Utils
import { getAvailableSounds, SOUND_LABELS } from "@/utils/sound";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  prayerId: string;
  prayerName: string;
  type: NotificationType;
  defaults: NotificationConfig | NotificationWithTiming;
  currentOverride?: Partial<NotificationConfig | NotificationWithTiming>;
  onSave: (config: Partial<NotificationConfig | NotificationWithTiming>) => void;
  onReset: () => void;
  hasTiming?: boolean;
  timingLabel?: string;
  supportsVibration?: boolean;
};

const PrayerCustomizationModal: FC<Props> = ({
  isOpen,
  onClose,
  prayerName,
  type,
  defaults,
  currentOverride,
  onSave,
  onReset,
  hasTiming = false,
  timingLabel,
  supportsVibration = true,
}) => {
  const { t } = useTranslation();

  // Merge defaults with overrides
  const currentConfig = { ...defaults, ...currentOverride };

  // Local state
  const [enabled, setEnabled] = useState(currentConfig.enabled || false);
  const [sound, setSound] = useState(currentConfig.sound || "default");
  const [vibration, setVibration] = useState(currentConfig.vibration || false);
  const [timing, setTiming] = useState(
    hasTiming ? (currentConfig as NotificationWithTiming).timing || 10 : 10
  );
  const [isTimingOpen, setIsTimingOpen] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);

  // Sound options based on notification type
  const getSoundOptions = getAvailableSounds(type);

  const timingOptions = [5, 10, 15, 20, 30];

  const handleSave = () => {
    const config: any = {};

    // Only save values that differ from defaults
    if (enabled !== defaults.enabled) config.enabled = enabled;
    if (sound !== defaults.sound) config.sound = sound;
    if (vibration !== defaults.vibration) config.vibration = vibration;
    if (hasTiming && timing !== (defaults as NotificationWithTiming).timing) {
      config.timing = timing;
    }

    // If nothing changed from defaults, reset the override
    if (Object.keys(config).length === 0) {
      onReset();
    } else {
      onSave(config);
    }

    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const getTranslatedLabel = () => {
    return t((SOUND_LABELS[type] as Record<string, string>)[sound]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop className="bg-black/50" />
      <ModalContent className="bg-white mx-4 my-auto rounded-xl shadow-xl">
        <ModalHeader className="px-6 pt-6 pb-4">
          <VStack className="flex-1" space="xs">
            <Text className="text-xl font-bold text-gray-900 text-left">
              {t("notification.customize")} {prayerName}
            </Text>
          </VStack>
          <ModalCloseButton>
            <X size={20} color="#6B7280" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <VStack space="lg">
            {/* Enabled Toggle */}
            <HStack className="justify-between items-center py-2">
              <Text className="text-base font-medium text-gray-900 text-left flex-1">
                {t("common.enable")}
              </Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300"
                trackColor={{ false: "#D1D5DB", true: "#3B82F6" }}
                thumbColor={enabled ? "#FFFFFF" : "#FFFFFF"}
              />
            </HStack>

            <Divider className="bg-gray-200" />

            {/* Timing (Iqama & PreAthan) */}
            {hasTiming && timingLabel && (
              <>
                <HStack className="justify-between items-center py-2">
                  <Text className="text-base font-medium text-gray-900 text-left flex-1">
                    {timingLabel}
                  </Text>
                  <Select
                    selectedValue={timing.toString()}
                    onValueChange={(value) => setTiming(parseInt(value))}
                    onOpen={() => setIsTimingOpen(true)}
                    onClose={() => setIsTimingOpen(false)}
                    accessibilityLabel={t("notification.timing.selectPlaceholder")}>
                    <SelectTrigger
                      variant="outline"
                      size="sm"
                      className={`w-28 h-10 rounded-lg bg-white border-2 transition-all duration-200 ${
                        isTimingOpen ? "border-blue-500" : "border-gray-300"
                      } active:bg-gray-50`}>
                      <SelectInput
                        placeholder={t("notification.timing.selectPlaceholder")}
                        className="text-center text-gray-900 font-medium"
                      />
                      <SelectIcon className="ml-2" as={ChevronDown} size="md" color="#6B7280" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop className="bg-black/50" />
                      <SelectContent className="bg-white rounded-xl shadow-xl mx-4">
                        <SelectDragIndicatorWrapper className="py-2">
                          <SelectDragIndicator className="w-12 h-1 bg-gray-300 rounded-full" />
                        </SelectDragIndicatorWrapper>
                        <SelectScrollView className="px-4 pt-2 pb-6 max-h-80">
                          {timingOptions.map((min) => {
                            const isSelected = timing === min;
                            return (
                              <SelectItem
                                key={min}
                                label={t("common.minute", { count: min })}
                                value={min.toString()}
                                className={`px-4 py-4 mb-2 rounded-lg border transition-all duration-200 ${
                                  isSelected
                                    ? "bg-blue-50 border-blue-500"
                                    : "bg-white border-gray-200 hover:bg-gray-50"
                                }`}
                              />
                            );
                          })}
                        </SelectScrollView>
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </HStack>
                <Divider className="bg-gray-200" />
              </>
            )}

            {/* Sound Selection */}
            <HStack className="justify-between items-center py-2">
              <Text className="text-base font-medium text-gray-900 text-left flex-1">
                {t("notification.sound")}
              </Text>
              <Select
                selectedValue={sound}
                initialLabel={sound ? getTranslatedLabel() : ""}
                onValueChange={(value) => setSound(value as typeof sound)}
                onOpen={() => setIsSoundOpen(true)}
                onClose={() => setIsSoundOpen(false)}
                accessibilityLabel={t("notification.sound.selectPlaceholder")}>
                <SelectTrigger
                  variant="outline"
                  size="sm"
                  className={`w-40 h-10 rounded-lg bg-white border-2 transition-all duration-200 ${
                    isSoundOpen ? "border-blue-500" : "border-gray-300"
                  } active:bg-gray-50`}>
                  <SelectInput
                    placeholder={t("notification.sound.selectPlaceholder", "اختر الصوت")}
                    className="text-left text-gray-900 font-medium"
                  />
                  <SelectIcon className="ml-2" as={ChevronDown} size="md" color="#6B7280" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop className="bg-black/50" />
                  <SelectContent className="bg-white rounded-xl shadow-xl mx-4">
                    <SelectDragIndicatorWrapper className="py-2">
                      <SelectDragIndicator className="w-12 h-1 bg-gray-300 rounded-full" />
                    </SelectDragIndicatorWrapper>
                    <SelectScrollView className="px-4 pt-2 pb-6 max-h-80">
                      {getSoundOptions.map((option) => {
                        const isSelected = sound === option.value;
                        return (
                          <SelectItem
                            key={option.value}
                            label={t(option.label, option.label)}
                            value={option.value}
                            className={`px-4 py-4 mb-2 rounded-lg border transition-all duration-200 ${
                              isSelected
                                ? "bg-blue-50 border-blue-500"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                          />
                        );
                      })}
                    </SelectScrollView>
                  </SelectContent>
                </SelectPortal>
              </Select>
            </HStack>

            {/* Vibration */}
            {supportsVibration && (
              <>
                <Divider className="bg-gray-200" />
                <HStack className="justify-between items-center py-2">
                  <Text className="text-base font-medium text-gray-900 text-left flex-1">
                    {t("notification.vibration")}
                  </Text>
                  <Switch
                    value={vibration}
                    onValueChange={setVibration}
                    className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300"
                    trackColor={{ false: "#D1D5DB", true: "#3B82F6" }}
                    thumbColor={vibration ? "#FFFFFF" : "#FFFFFF"}
                  />
                </HStack>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter className="px-6 py-6 border-t border-gray-100">
          <VStack space="sm" className="w-full">
            <Button
              onPress={handleSave}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg shadow-sm">
              <ButtonText className="text-white font-semibold text-base">
                {t("common.saveChanges")}
              </ButtonText>
            </Button>
            <Button
              variant="outline"
              onPress={handleReset}
              className="w-full h-12 border-2 border-gray-300 hover:border-gray-400 active:border-gray-500 rounded-lg bg-white">
              <ButtonText className="text-gray-700 font-semibold text-base">
                {t("notification.resetToDefault")}
              </ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PrayerCustomizationModal;
