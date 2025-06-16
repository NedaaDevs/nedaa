import { useState } from "react";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";

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
  };

  return (
    <>
      <Pressable
        className="items-center justify-center p-2 rounded-md"
        onPress={() => setModalVisible(true)}
        accessibilityLabel={t("settings.crashReporting.accessibilityLabel")}
        accessibilityHint={t("settings.crashReporting.accessibilityHint")}>
        <Icon className="text-typography" as={Bug} />
      </Pressable>

      <Modal isOpen={modalVisible} onClose={() => setModalVisible(false)} size="md">
        <ModalBackdrop />
        <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl relative">
          <ModalCloseButton className="absolute top-4 right-4 z-10">
            <Icon as={X} className="text-typography-secondary" size="lg" />
          </ModalCloseButton>

          <ModalHeader className="px-6 pt-6 pb-4 pr-12">
            <Text className="text-xl font-bold text-typography text-left">
              {t("settings.crashReporting.title")}
            </Text>
          </ModalHeader>

          <ModalBody className="px-6">
            <VStack space="md">
              <Text className="text-left text-typography-secondary">
                {t("settings.crashReporting.description")}
              </Text>

              <VStack space="xs">
                <Text className="text-base text-typography">
                  {t("settings.crashReporting.bullet1")}
                </Text>
                <Text className="text-base text-typography">
                  {t("settings.crashReporting.bullet2")}
                </Text>
                <Text className="text-base text-typography">
                  {t("settings.crashReporting.bullet3")}
                </Text>
              </VStack>

              <Text className="text-left text-typography-secondary">
                {t("settings.crashReporting.privacyNote")}
              </Text>

              <HStack className="justify-between items-center">
                <Text className="text-base font-medium text-typography flex-1">
                  {t("settings.crashReporting.enableToggle")}
                </Text>
                <Switch value={sendCrashLogs} onValueChange={handleToggle} />
              </HStack>
            </VStack>
          </ModalBody>

          <ModalFooter className="px-6 py-6">
            <Button onPress={() => setModalVisible(false)} className="w-full bg-accent-primary">
              <ButtonText className="text-background">{t("common.done")}</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CrashLogButton;
