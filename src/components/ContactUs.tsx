import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

// Components
import { ActionsheetFlatList } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon, MailIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Modal } from "@/components/ui/modal";
import MailClientsList from "@/components/MailClientsList";

// Icons
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

// Hooks
import { useColorScheme } from "nativewind";

// Enums
import { AppMode } from "@/enums/app";

const ContactUs = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  const [mailModalVisible, setMailModalVisible] = useState(false);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;

  const handleOpenWhatsApp = () => {
    if (whatsappNumber) {
      Linking.openURL(`https://wa.me/${whatsappNumber}`);
    }
  };

  const handleOpenTelegram = () => {
    if (telegramUsername) {
      Linking.openURL(`https://t.me/${telegramUsername}`);
    }
  };

  const handleEmailContact = () => {
    setMailModalVisible(true);
  };

  const handleCloseMailModal = () => {
    setMailModalVisible(false);
  };

  const contactOptions = [
    {
      id: "email",
      title: t("settings.help.contact.email"),
      icon: "mail",
      action: handleEmailContact,
    },
  ];

  // Render option if number available
  if (whatsappNumber) {
    contactOptions.push({
      id: "whatsapp",
      title: t("settings.help.contact.whatsapp"),
      icon: "whatsapp",
      action: handleOpenWhatsApp,
    });
  }

  // Render option if username available
  if (telegramUsername) {
    contactOptions.push({
      id: "telegram",
      title: t("settings.help.contact.telegram"),
      icon: "telegram",
      action: handleOpenTelegram,
    });
  }

  const renderIcon = (icon: string) => {
    switch (icon) {
      case "mail":
        return <Icon as={MailIcon} size="xl" className="text-accent-primary" />;
      case "whatsapp":
        return <FontAwesome5 name="whatsapp" size={24} color="#25D366" />;
      case "telegram":
        return (
          <FontAwesome5
            name="telegram-plane"
            size={24}
            color={colorScheme === AppMode.DARK ? "white" : "black"}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Box className="w-full px-4 pt-6 pb-4 flex flex-col bg-background">
        <Box className="w-full flex flex-col items-start mb-4">
          <Text className="text-2xl text-typography-secondary font-medium">
            {t("settings.help.contactUs").toUpperCase()}
          </Text>
        </Box>

        <Box className="w-full rounded-lg overflow-hidden">
          <ActionsheetFlatList
            data={contactOptions}
            renderItem={({ item, index }: any) => (
              <Box
                className={`w-full ${
                  index < contactOptions.length - 1 ? "border-b border-outline" : ""
                }`}>
                <Pressable
                  onPress={item.action}
                  className="py-5 px-5 flex-row justify-between items-center">
                  <Box className="flex-row items-center">
                    {renderIcon(item.icon)}
                    <Text className="text-xl font-semibold text-typography ml-4">{item.title}</Text>
                  </Box>
                </Pressable>
              </Box>
            )}
            keyExtractor={(item: any) => item.id}
          />
        </Box>
      </Box>

      {/* Mail Clients Modal */}
      <Modal useRNModal isOpen={mailModalVisible} onClose={handleCloseMailModal}>
        <MailClientsList onClose={handleCloseMailModal} />
      </Modal>
    </>
  );
};

export default ContactUs;
