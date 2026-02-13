import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ActivityIndicator, TextInput, Alert } from "react-native";
import { useTheme } from "tamagui";
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
import { Button } from "@/components/ui/button";
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
  const theme = useTheme();
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
      <ModalBackdrop />
      <ModalContent>
        {/* Header with gradient accent */}
        <ModalHeader>
          <HStack gap="$3" alignItems="center" flex={1} paddingRight="$8">
            <Icon as={Speaker} size="xl" color="$primary" />
            <Text size="xl" bold color="$typography" flex={1}>
              {t("notification.customSound.add")}
            </Text>
          </HStack>
          <ModalCloseButton style={{ position: "absolute", right: 16, top: 0 }}>
            <Icon as={X} size="lg" color="$typographySecondary" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <VStack gap="$5">
            {/* File Picker Section */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography" marginBottom="$1">
                {t("notification.customSound.selectFile")}
              </Text>
              <Pressable
                onPress={handlePickFile}
                disabled={isProcessing}
                borderWidth={2}
                borderStyle="dashed"
                borderRadius="$6"
                padding="$4"
                borderColor={selectedFile ? "$primary" : "$outline"}
                backgroundColor={selectedFile ? "$backgroundInfo" : "$backgroundMuted"}>
                <HStack gap="$3" alignItems="center" justifyContent="center">
                  <Icon
                    as={selectedFile ? Check : Upload}
                    size="lg"
                    color={selectedFile ? "$primary" : "$typographySecondary"}
                  />
                  <VStack flex={1}>
                    <Text fontWeight="500" color={selectedFile ? "$primary" : "$typography"}>
                      {selectedFile ? selectedFile.name : t("notification.customSound.chooseFile")}
                    </Text>
                    {selectedFile && (
                      <Text size="xs" color="$typographySecondary" marginTop="$1">
                        {formatFileSize(selectedFile.size ?? 0)}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Pressable>
            </VStack>

            {/* Sound Name Input */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography" marginBottom="$1">
                {t("notification.customSound.name")}
              </Text>
              <TextInput
                value={soundName}
                onChangeText={setSoundName}
                placeholder={t("notification.customSound.namePlaceholder")}
                editable={!isProcessing}
                style={{
                  height: 56,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: theme.outline?.val,
                  fontWeight: "500",
                  color: theme.typography?.val,
                  backgroundColor: theme.background?.val,
                }}
                placeholderTextColor={theme.typographySecondary?.val}
              />
            </VStack>

            {/* Notification Types Selection */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography" marginBottom="$2">
                {t("notification.customSound.availableFor")}
              </Text>
              <VStack
                gap="$1"
                backgroundColor="$background"
                borderRadius="$6"
                borderWidth={1}
                borderColor="$outline"
                padding="$2">
                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.PRAYER)}
                  disabled={isProcessing}
                  flexDirection="row"
                  alignItems="center"
                  padding="$3"
                  borderRadius="$4"
                  backgroundColor={
                    selectedTypes.includes(NOTIFICATION_TYPE.PRAYER)
                      ? "$backgroundInfo"
                      : "transparent"
                  }>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.PRAYER) ? CheckSquare : Square}
                    size="lg"
                    color={
                      selectedTypes.includes(NOTIFICATION_TYPE.PRAYER)
                        ? "$primary"
                        : "$typographySecondary"
                    }
                  />
                  <Text color="$typography" fontWeight="500" flex={1} marginStart="$3">
                    {t("notification.type.prayer")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.IQAMA)}
                  disabled={isProcessing}
                  flexDirection="row"
                  alignItems="center"
                  padding="$3"
                  borderRadius="$4"
                  backgroundColor={
                    selectedTypes.includes(NOTIFICATION_TYPE.IQAMA)
                      ? "$backgroundInfo"
                      : "transparent"
                  }>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.IQAMA) ? CheckSquare : Square}
                    size="lg"
                    color={
                      selectedTypes.includes(NOTIFICATION_TYPE.IQAMA)
                        ? "$primary"
                        : "$typographySecondary"
                    }
                  />
                  <Text color="$typography" fontWeight="500" flex={1} marginStart="$3">
                    {t("notification.type.iqama")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.PRE_ATHAN)}
                  disabled={isProcessing}
                  flexDirection="row"
                  alignItems="center"
                  padding="$3"
                  borderRadius="$4"
                  backgroundColor={
                    selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN)
                      ? "$backgroundInfo"
                      : "transparent"
                  }>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN) ? CheckSquare : Square}
                    size="lg"
                    color={
                      selectedTypes.includes(NOTIFICATION_TYPE.PRE_ATHAN)
                        ? "$primary"
                        : "$typographySecondary"
                    }
                  />
                  <Text color="$typography" fontWeight="500" flex={1} marginStart="$3">
                    {t("notification.type.preAthan")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => !isProcessing && toggleType(NOTIFICATION_TYPE.QADA)}
                  disabled={isProcessing}
                  flexDirection="row"
                  alignItems="center"
                  padding="$3"
                  borderRadius="$4"
                  backgroundColor={
                    selectedTypes.includes(NOTIFICATION_TYPE.QADA)
                      ? "$backgroundInfo"
                      : "transparent"
                  }>
                  <Icon
                    as={selectedTypes.includes(NOTIFICATION_TYPE.QADA) ? CheckSquare : Square}
                    size="lg"
                    color={
                      selectedTypes.includes(NOTIFICATION_TYPE.QADA)
                        ? "$primary"
                        : "$typographySecondary"
                    }
                  />
                  <Text color="$typography" fontWeight="500" flex={1} marginStart="$3">
                    {t("notification.type.qada")}
                  </Text>
                </Pressable>
              </VStack>
            </VStack>

            {/* Duplicate Warning Message */}
            {duplicateWarning && (
              <HStack
                gap="$2"
                backgroundColor="$backgroundWarning"
                borderWidth={1}
                borderColor="$borderWarning"
                borderRadius="$6"
                padding="$4">
                <Icon as={AlertTriangle} size="sm" color="$warning" />
                <Text size="sm" color="$warning" flex={1} fontWeight="500">
                  {duplicateWarning}
                </Text>
              </HStack>
            )}

            {/* Error Message */}
            {error && (
              <HStack
                gap="$2"
                backgroundColor="$backgroundError"
                borderWidth={1}
                borderColor="$borderError"
                borderRadius="$6"
                padding="$4">
                <Icon as={X} size="sm" color="$error" />
                <Text size="sm" color="$error" flex={1} fontWeight="500">
                  {error}
                </Text>
              </HStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack gap="$2" width="100%">
            <Button
              size="lg"
              onPress={handleAdd}
              backgroundColor={canAdd ? "$accentPrimary" : "$backgroundMuted"}
              borderRadius="$6"
              disabled={!canAdd}>
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.typographyContrast?.val} />
              ) : (
                <Button.Text fontWeight="600" color="$typographyContrast">
                  {t("common.add")}
                </Button.Text>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onPress={handleClose}
              borderWidth={2}
              borderColor="$outline"
              borderRadius="$6"
              disabled={isProcessing}>
              <Button.Text fontWeight="600" color="$typography">
                {t("common.cancel")}
              </Button.Text>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
