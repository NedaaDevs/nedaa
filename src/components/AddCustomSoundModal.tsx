import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ActivityIndicator, TextInput, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";

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
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { X, Check, Upload, Square, CheckSquare, Speaker, AlertTriangle } from "lucide-react-native";

// Types
import type { NotificationType } from "@/types/notification";
import type { AddCustomSoundResult } from "@/types/customSound";

// Enums
import { PlatformType } from "@/enums/app";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Utils
import {
  pickAudioFile,
  addCustomSound,
  formatFileSize,
  findDuplicateSound,
} from "@/utils/customSoundManager";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

type AddCustomSoundModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: AddCustomSoundResult) => void;
};

export default function AddCustomSoundModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCustomSoundModalProps) {
  const { t } = useTranslation();
  const { customSounds } = useCustomSoundsStore();

  const [soundName, setSoundName] = useState("");
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<NotificationType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forceAdd, setForceAdd] = useState(false);

  if (Platform.OS !== PlatformType.ANDROID) {
    return null;
  }

  const handlePickFile = async () => {
    try {
      setError(null);
      setDuplicateWarning(null);
      setForceAdd(false);
      const file = await pickAudioFile();

      if (file) {
        // Check for duplicates
        const duplicate = findDuplicateSound(file, customSounds);

        if (duplicate && !forceAdd) {
          // Show duplicate warning
          Alert.alert(
            t("notification.customSound.duplicateTitle"),
            t("notification.customSound.duplicateMessage", {
              existingName: duplicate.name,
            }),
            [
              {
                text: t("common.cancel"),
                style: "cancel",
                onPress: () => {
                  // Don't select the file
                  setSelectedFile(null);
                },
              },
              {
                text: t("notification.customSound.addAnyway"),
                onPress: () => {
                  // Proceed with the file
                  setSelectedFile(file);
                  setForceAdd(true);
                  setDuplicateWarning(
                    t("notification.customSound.duplicateMessage", {
                      existingName: duplicate.name,
                    })
                  );

                  // Auto-fill name from filename if empty
                  if (!soundName) {
                    const name = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
                    setSoundName(name);
                  }
                },
              },
            ]
          );
        } else {
          // No duplicate or user has chosen to proceed
          setSelectedFile(file);

          // Auto-fill name from filename if empty
          if (!soundName) {
            const name = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            setSoundName(name);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pick file");
    }
  };

  const toggleType = (type: NotificationType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAdd = async () => {
    if (!selectedFile || !soundName.trim() || selectedTypes.length === 0) {
      setError(t("notification.customSound.validationError"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Use the already stored file, passing existing sounds and force flag
      const result = await addCustomSound(
        selectedFile,
        soundName.trim(),
        selectedTypes,
        customSounds,
        forceAdd
      );

      if (result.success) {
        onSuccess(result);
        handleClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notification.customSound.addError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSoundName("");
    setSelectedFile(null);
    setSelectedTypes([]);
    setError(null);
    setDuplicateWarning(null);
    setForceAdd(false);
    onClose();
  };

  const canAdd = selectedFile && soundName.trim() && selectedTypes.length > 0 && !isProcessing;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalBackdrop className="bg-black/50" />
      <ModalContent className="bg-background-secondary m-4 rounded-2xl shadow-2xl">
        {/* Header with gradient accent */}
        <ModalHeader className="px-6 pt-6 pb-4 border-b border-outline">
          <HStack space="md" className="items-center flex-1 pr-8">
            <Icon as={Speaker} size="xl" className="text-primary" />
            <Text className="text-xl font-bold text-typography flex-1">
              {t("notification.customSound.add")}
            </Text>
          </HStack>
          <ModalCloseButton className="absolute right-4 top-6">
            <Icon as={X} size="lg" className="text-typography-secondary" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody className="px-6">
          <VStack space="xl">
            {/* File Picker Section */}
            <VStack space="sm">
              <Text size="sm" className="font-semibold text-typography mb-1">
                {t("notification.customSound.selectFile")}
              </Text>
              <Pressable
                onPress={handlePickFile}
                disabled={isProcessing}
                className={`border-2 border-dashed rounded-xl p-4 ${
                  selectedFile
                    ? "border-primary bg-background-info/10"
                    : "border-outline bg-background-muted"
                }`}>
                <HStack space="md" className="items-center justify-center">
                  <Icon
                    as={selectedFile ? Check : Upload}
                    size="lg"
                    className={selectedFile ? "text-primary" : "text-typography-secondary"}
                  />
                  <VStack className="flex-1">
                    <Text
                      className={`font-medium ${selectedFile ? "text-primary" : "text-typography"}`}>
                      {selectedFile ? selectedFile.name : t("notification.customSound.chooseFile")}
                    </Text>
                    {selectedFile && (
                      <Text size="xs" className="text-typography-secondary mt-1">
                        {formatFileSize(selectedFile.size ?? 0)}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Pressable>
            </VStack>

            {/* Sound Name Input */}
            <VStack space="sm">
              <Text size="sm" className="font-semibold text-typography mb-1">
                {t("notification.customSound.name")}
              </Text>
              <TextInput
                value={soundName}
                onChangeText={setSoundName}
                placeholder={t("notification.customSound.namePlaceholder")}
                editable={!isProcessing}
                className="h-14 px-4 bg-background rounded-xl border-2 border-outline text-typography font-medium focus:border-primary"
                placeholderTextColor="#9ca3af"
              />
            </VStack>

            {/* Notification Types Selection */}
            <VStack space="sm">
              <Text size="sm" className="font-semibold text-typography mb-2">
                {t("notification.customSound.availableFor")}
              </Text>
              <VStack space="xs" className="bg-background rounded-xl border border-outline p-2">
                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.PRAYER)}
                  disabled={isProcessing}
                  className={`flex-row items-center p-3 rounded-lg ${
                    selectedTypes.includes(NOTIFICATION_TYPE.PRAYER)
                      ? "bg-background-info/20"
                      : "bg-transparent active:bg-surface-hover"
                  }`}>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.PRAYER) ? CheckSquare : Square}
                    size="lg"
                    className={
                      selectedTypes.includes(NOTIFICATION_TYPE.PRAYER)
                        ? "text-primary mr-3"
                        : "text-typography-secondary mr-3"
                    }
                  />
                  <Text className="text-typography font-medium flex-1">
                    {t("notification.type.prayer")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.IQAMA)}
                  disabled={isProcessing}
                  className={`flex-row items-center p-3 rounded-lg ${
                    selectedTypes.includes(NOTIFICATION_TYPE.IQAMA)
                      ? "bg-background-info/20"
                      : "bg-transparent active:bg-surface-hover"
                  }`}>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.IQAMA) ? CheckSquare : Square}
                    size="lg"
                    className={
                      selectedTypes.includes(NOTIFICATION_TYPE.IQAMA)
                        ? "text-primary mr-3"
                        : "text-typography-secondary mr-3"
                    }
                  />
                  <Text className="text-typography font-medium flex-1">
                    {t("notification.type.iqama")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.PRE_ATHAN)}
                  disabled={isProcessing}
                  className={`flex-row items-center p-3 rounded-lg ${
                    selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN)
                      ? "bg-background-info/20"
                      : "bg-transparent active:bg-surface-hover"
                  }`}>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN) ? CheckSquare : Square}
                    size="lg"
                    className={
                      selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN)
                        ? "text-primary mr-3"
                        : "text-typography-secondary mr-3"
                    }
                  />
                  <Text className="text-typography font-medium flex-1">
                    {t("notification.type.preAthan")}
                  </Text>
                </Pressable>
              </VStack>
            </VStack>

            {/* Duplicate Warning Message */}
            {duplicateWarning && (
              <HStack
                space="sm"
                className="bg-background-warning border border-border-warning rounded-xl p-4">
                <Icon as={AlertTriangle} size="sm" className="text-warning" />
                <Text size="sm" className="text-warning flex-1 font-medium">
                  {duplicateWarning}
                </Text>
              </HStack>
            )}

            {/* Error Message */}
            {error && (
              <HStack
                space="sm"
                className="bg-background-error border border-border-error rounded-xl p-4">
                <Icon as={X} size="sm" className="text-error" />
                <Text size="sm" className="text-error flex-1 font-medium">
                  {error}
                </Text>
              </HStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter className="px-6 pb-6 pt-4 border-t border-outline">
          <VStack space="sm" className="w-full">
            <Button
              size="lg"
              onPress={handleAdd}
              className={`${canAdd ? "bg-accent-primary" : "bg-background-muted"} rounded-xl`}
              disabled={!canAdd}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <ButtonText className="font-semibold text-background">{t("common.add")}</ButtonText>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onPress={handleClose}
              className="border-2 border-outline rounded-xl"
              disabled={isProcessing}>
              <ButtonText className="font-semibold text-typography">
                {t("common.cancel")}
              </ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
