import { useState } from "react";

// Components
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { MessageToast } from "@/components/feedback";

// Icons
import { Bug, X } from "lucide-react-native";

// Hooks
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";

const CrashLogButton = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const { sendCrashLogs, setSendCrashLogs } = useAppStore();
  const { t } = useTranslation();

  const handleToggle = (value: boolean) => {
    setSendCrashLogs(value);
    MessageToast.showInfo(t("settings.crashLog.restartRequired"));
  };

  return (
    <>
      <Pressable
        alignItems="center"
        justifyContent="center"
        padding="$2"
        borderRadius="$2"
        minHeight={44}
        minWidth={44}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t("settings.crashReporting.accessibilityLabel")}
        accessibilityHint={t("settings.crashReporting.accessibilityHint")}>
        <Icon color="$typography" as={Bug} />
      </Pressable>

      <Modal isOpen={modalVisible} onClose={() => setModalVisible(false)} size="md">
        <ModalBackdrop />
        <ModalContent>
          <ModalCloseButton>
            <Icon as={X} color="$typographySecondary" size="lg" />
          </ModalCloseButton>

          <ModalHeader>
            <Text size="xl" bold color="$typography">
              {t("settings.crashReporting.title")}
            </Text>
          </ModalHeader>

          <ModalBody>
            <VStack gap="$3">
              <Text color="$typographySecondary">{t("settings.crashReporting.description")}</Text>

              <VStack gap="$1">
                <Text color="$typography">{t("settings.crashReporting.bullet1")}</Text>
                <Text color="$typography">{t("settings.crashReporting.bullet2")}</Text>
                <Text color="$typography">{t("settings.crashReporting.bullet3")}</Text>
              </VStack>

              <Text color="$typographySecondary">{t("settings.crashReporting.privacyNote")}</Text>

              <HStack justifyContent="space-between" alignItems="center">
                <Text fontWeight="500" color="$typography" flex={1}>
                  {t("settings.crashReporting.enableToggle")}
                </Text>
                <Switch value={sendCrashLogs} onValueChange={handleToggle} />
              </HStack>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button onPress={() => setModalVisible(false)} width="100%">
              <Button.Text>{t("common.done")}</Button.Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CrashLogButton;
