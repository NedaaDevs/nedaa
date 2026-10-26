import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ActivityIndicator, TextInput, Alert } from "react-native";
import { useTheme } from "@/components/ui/theme-color";
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
import { X, Check, Upload, Speaker, TriangleAlert } from "lucide-react-native";

// Types
import type { NotificationType } from "@/types/notification";
import type { AddCustomSoundResult } from "@/types/customSound";

// Enums
import { PlatformType } from "@/enums/app";

// Constants
import { CUSTOM_SOUND_ERROR, CUSTOM_SOUND_MAX_MB } from "@/constants/CustomSound";
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Utils
import {
  pickAudioFile,
  addCustomSound,
  formatFileSize,
  findDuplicateSound,
  validateAudioFile,
} from "@/utils/customSoundManager";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

// A custom sound is offered for every notification type that supports one. The alarm
// picker lists custom sounds independently, since alarms store the URI, not a sound key.
const CUSTOM_SOUND_NOTIFICATION_TYPES: NotificationType[] = [
  NOTIFICATION_TYPE.PRAYER,
  NOTIFICATION_TYPE.IQAMA,
  NOTIFICATION_TYPE.PRE_ATHAN,
  NOTIFICATION_TYPE.QADA,
];

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forceAdd, setForceAdd] = useState(false);

  if (Platform.OS !== PlatformType.ANDROID) {
    return null;
  }

  const describeError = (code: string) =>
    code === CUSTOM_SOUND_ERROR.TOO_LARGE
      ? t("notification.customSound.fileTooLarge", { maxMb: CUSTOM_SOUND_MAX_MB })
      : code;

  const choose = (file: DocumentPicker.DocumentPickerAsset | null) => {
    if (!file) return;

    // Refused at pick time, so a name is never typed for a file that cannot
    // be added.
    if (validateAudioFile(file).error === CUSTOM_SOUND_ERROR.TOO_LARGE) {
      setSelectedFile(null);
      setError(describeError(CUSTOM_SOUND_ERROR.TOO_LARGE));
      return;
    }

    // An empty name takes the file's name without its extension.
    const select = () => {
      setSelectedFile(file);
      if (!soundName) setSoundName(file.name.replace(/\.[^/.]+$/, ""));
    };

    const duplicate = findDuplicateSound(file, customSounds);
    if (!duplicate) return select();

    const duplicateMessage = t("notification.customSound.duplicateMessage", {
      existingName: duplicate.name,
    });
    Alert.alert(t("notification.customSound.duplicateTitle"), duplicateMessage, [
      { text: t("common.cancel"), style: "cancel", onPress: () => setSelectedFile(null) },
      {
        text: t("notification.customSound.addAnyway"),
        onPress: () => {
          select();
          setForceAdd(true);
          setDuplicateWarning(duplicateMessage);
        },
      },
    ]);
  };

  // Chains, not tries: the React Compiler cannot lower a try that holds a
  // `finally`, a `&&` or a ternary, and skips the whole modal.
  const handlePickFile = async () => {
    setError(null);
    setDuplicateWarning(null);
    setForceAdd(false);
    await pickAudioFile()
      .then(choose)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to pick file"));
  };

  const handleAdd = async () => {
    if (!selectedFile || !soundName.trim()) {
      setError(t("notification.customSound.validationError"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Use the already stored file, passing existing sounds and force flag
    await addCustomSound(
      selectedFile,
      soundName.trim(),
      CUSTOM_SOUND_NOTIFICATION_TYPES,
      customSounds,
      forceAdd
    )
      .then((result) => {
        if (result.success) {
          onSuccess(result);
          handleClose();
        } else {
          setError(describeError(result.error));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("notification.customSound.addError"))
      );
    setIsProcessing(false);
  };

  const handleClose = () => {
    setSoundName("");
    setSelectedFile(null);
    setError(null);
    setDuplicateWarning(null);
    setForceAdd(false);
    onClose();
  };

  const canAdd = selectedFile && soundName.trim() && !isProcessing;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        {/* Header with gradient accent */}
        <ModalHeader>
          <HStack gap="$3" alignItems="center" flex={1} paddingEnd="$8">
            <Icon as={Speaker} size="xl" color="$primary" />
            <Text size="xl" bold color="$typography" flex={1}>
              {t("notification.customSound.add")}
            </Text>
          </HStack>
          <ModalCloseButton style={{ position: "absolute", end: 16, top: 0 }}>
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
                accessibilityRole="button"
                accessibilityLabel={t("a11y.customSound.pickFile")}
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
                accessibilityLabel={t("a11y.customSound.soundName")}
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

            {/* Duplicate Warning Message */}
            {duplicateWarning && (
              <HStack
                gap="$2"
                backgroundColor="$backgroundWarning"
                borderWidth={1}
                borderColor="$borderWarning"
                borderRadius="$6"
                padding="$4">
                <Icon as={TriangleAlert} size="sm" color="$warning" />
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
