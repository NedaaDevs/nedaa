import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

// Components
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
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

import { useTheme } from "@/components/ui/theme-color";

type ContactOption = { title: string; hint: string; icon: ReactNode; action: () => void };

const ContactUs = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticMedium = useHaptic(HAPTIC_FEEDBACK.MEDIUM);

  const [mailModalVisible, setMailModalVisible] = useState(false);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;

  const openChat = (url: string) => {
    hapticMedium();
    Linking.openURL(url);
  };

  const handleEmailContact = () => {
    hapticMedium();
    setMailModalVisible(true);
  };

  const handleCloseMailModal = () => {
    setMailModalVisible(false);
  };

  // A chat option shows only when the build carries its address.
  const contactOptions: ContactOption[] = [
    {
      title: t("settings.help.contact.email"),
      hint: t("a11y.help.emailHint"),
      icon: <Icon as={MailIcon} size="xl" color="$accentPrimary" />,
      action: handleEmailContact,
    },
    ...(whatsappNumber
      ? [
          {
            title: t("settings.help.contact.whatsapp"),
            hint: t("a11y.help.whatsappHint"),
            icon: <FontAwesome5 name="whatsapp" size={24} color="#25D366" />,
            action: () => openChat(`https://wa.me/${whatsappNumber}`),
          },
        ]
      : []),
    ...(telegramUsername
      ? [
          {
            title: t("settings.help.contact.telegram"),
            hint: t("a11y.help.telegramHint"),
            icon: <FontAwesome5 name="telegram-plane" size={24} color={theme.typography?.val} />,
            action: () => openChat(`https://t.me/${telegramUsername}`),
          },
        ]
      : []),
  ];

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
          <Text
            size="2xl"
            color="$typographySecondary"
            fontWeight="500"
            accessibilityRole="header"
            accessibilityLabel={t("settings.help.contactUs")}>
            {t("settings.help.contactUs").toUpperCase()}
          </Text>
        </Box>

        <Box width="100%" borderRadius="$4">
          {contactOptions.map((option, index) => {
            const divided = index < contactOptions.length - 1;
            return (
              <Box
                key={option.title}
                width="100%"
                borderBottomWidth={divided ? 1 : 0}
                borderColor={divided ? "$outline" : undefined}>
                <Pressable
                  onPress={option.action}
                  paddingVertical="$5"
                  paddingHorizontal="$5"
                  flexDirection="row"
                  alignItems="center"
                  accessibilityRole="button"
                  accessibilityLabel={option.title}
                  accessibilityHint={option.hint}>
                  <HStack alignItems="center" width="100%" gap="$4">
                    {option.icon}
                    <Text size="xl" fontWeight="600" color="$typography">
                      {option.title}
                    </Text>
                  </HStack>
                </Pressable>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Modal isOpen={mailModalVisible} onClose={handleCloseMailModal}>
        <MailClientsList onClose={handleCloseMailModal} />
      </Modal>
    </>
  );
};

export default ContactUs;
