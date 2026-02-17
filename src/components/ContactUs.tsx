import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

// Components
import { ActionsheetFlatList } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon, MailIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Modal } from "@/components/ui/modal";
import MailClientsList from "@/components/MailClientsList";

// Icons
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

import { useTheme } from "tamagui";

const ContactUs = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticMedium = useHaptic("medium");

  const [mailModalVisible, setMailModalVisible] = useState(false);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;

  const handleOpenWhatsApp = () => {
    hapticMedium();
    if (whatsappNumber) {
      Linking.openURL(`https://wa.me/${whatsappNumber}`);
    }
  };

  const handleOpenTelegram = () => {
    hapticMedium();
    if (telegramUsername) {
      Linking.openURL(`https://t.me/${telegramUsername}`);
    }
  };

  const handleEmailContact = () => {
    hapticMedium();
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

  if (whatsappNumber) {
    contactOptions.push({
      id: "whatsapp",
      title: t("settings.help.contact.whatsapp"),
      icon: "whatsapp",
      action: handleOpenWhatsApp,
    });
  }

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
        return <Icon as={MailIcon} size="xl" color="$accentPrimary" />;
      case "whatsapp":
        return <FontAwesome5 name="whatsapp" size={24} color="#25D366" />;
      case "telegram":
        return <FontAwesome5 name="telegram-plane" size={24} color={theme.typography?.val} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Box
        width="100%"
        paddingHorizontal="$4"
        paddingTop="$6"
        paddingBottom="$4"
        flexDirection="column"
        backgroundColor="$background">
        <Box width="100%" flexDirection="column" alignItems="flex-start" marginBottom="$4">
          <Text size="2xl" color="$typographySecondary" fontWeight="500">
            {t("settings.help.contactUs").toUpperCase()}
          </Text>
        </Box>

        <Box width="100%" borderRadius="$4">
          <ActionsheetFlatList
            data={contactOptions}
            renderItem={({ item, index }: any) => (
              <Box
                width="100%"
                borderBottomWidth={index < contactOptions.length - 1 ? 1 : 0}
                borderColor={index < contactOptions.length - 1 ? "$outline" : undefined}>
                <Pressable
                  onPress={item.action}
                  paddingVertical="$5"
                  paddingHorizontal="$5"
                  flexDirection="row"
                  alignItems="center">
                  <HStack alignItems="center" width="100%" gap="$4">
                    {renderIcon(item.icon)}
                    <Text size="xl" fontWeight="600" color="$typography">
                      {item.title}
                    </Text>
                  </HStack>
                </Pressable>
              </Box>
            )}
            keyExtractor={(item: any) => item.id}
          />
        </Box>
      </Box>

      <Modal isOpen={mailModalVisible} onClose={handleCloseMailModal}>
        <MailClientsList onClose={handleCloseMailModal} />
      </Modal>
    </>
  );
};

export default ContactUs;
