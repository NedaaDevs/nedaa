import { useState } from "react";

// Components
import { Modal } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/ui/icon";

// Icons
import { Bug } from "lucide-react-native";

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
        className="items-center justify-center p-2 rounded-md text-primary dark:text-secondary"
        onPress={() => setModalVisible(true)}
        accessibilityLabel={t("crashReporting.accessibilityLabel")}
        accessibilityHint={t("crashReporting.accessibilityHint")}>
        <Icon className="text-primary dark:text-secondary" as={Bug} />
      </Pressable>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <Box className="flex-1 justify-center items-center bg-black/50">
          <Box className="m-5 bg-white dark:bg-gray-800 rounded-xl p-6 w-[85%] max-w-md">
            <Text className="text-xl font-bold mb-4 text-primary dark:text-secondary text-start">
              {t("crashReporting.title")}
            </Text>

            <Text className="text-base text-typography dark:text-tertiary mb-4 text-start">
              {t("crashReporting.description")}
            </Text>

            <Box className="mb-4">
              <Text className="text-base text-typography dark:text-tertiary text-start">
                {t("crashReporting.bullet1")}
              </Text>
              <Text className="text-base text-typography dark:text-tertiary text-start">
                {t("crashReporting.bullet2")}
              </Text>
              <Text className="text-base text-typography dark:text-tertiary text-start">
                {t("crashReporting.bullet3")}
              </Text>
            </Box>

            <Text className="text-base text-typography dark:text-tertiary mb-6 text-start">
              {t("crashReporting.privacyNote")}
            </Text>

            <Box className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-medium text-typography dark:text-tertiary text-start">
                {t("crashReporting.enableToggle")}
              </Text>
              <Switch value={sendCrashLogs} onValueChange={handleToggle} />
            </Box>

            <Box className="flex-row justify-end rtl:justify-start mt-2">
              <Pressable
                className="py-2 px-4 rounded-md bg-blue-500"
                onPress={() => setModalVisible(false)}>
                <Text className="text-white">{t("done")}</Text>
              </Pressable>
            </Box>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default CrashLogButton;
