import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import { openComposer } from "react-native-email-link";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "tamagui";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon, MailIcon } from "@/components/ui/icon";
import { Modal, ModalBackdrop, ModalContent, ModalBody } from "@/components/ui/modal";
import { ClipboardCopy } from "lucide-react-native";

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSubject: string;
  getReportText: () => Promise<string>;
  getSummaryText: () => Promise<string>;
  onCopy: () => Promise<void>;
}

const ReportProblemModal: FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  emailSubject,
  getReportText,
  getSummaryText,
  onCopy,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isExporting, setIsExporting] = useState(false);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  const handleEmail = async () => {
    setIsExporting(true);
    onClose();
    try {
      const body = await getReportText();
      await openComposer({ to: supportEmail, subject: emailSubject, body });
    } catch (e) {
      console.error("Failed to open email:", e);
    }
    setIsExporting(false);
  };

  const handleWhatsApp = async () => {
    if (!whatsappNumber) return;
    setIsExporting(true);
    onClose();
    try {
      const summary = await getSummaryText();
      await Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open WhatsApp:", e);
    }
    setIsExporting(false);
  };

  const handleTelegram = async () => {
    if (!telegramUsername) return;
    setIsExporting(true);
    onClose();
    try {
      const summary = await getSummaryText();
      await Linking.openURL(`https://t.me/${telegramUsername}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open Telegram:", e);
    }
    setIsExporting(false);
  };

  const handleCopy = async () => {
    onClose();
    await onCopy();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent>
        <ModalBody>
          <Text size="lg" fontWeight="600" color="$typography" textAlign="center" marginBottom="$4">
            {t("alarm.report.shareVia")}
          </Text>
          <VStack gap="$2">
            <Pressable
              flexDirection="row"
              alignItems="center"
              minHeight={44}
              paddingHorizontal="$3"
              borderRadius="$6"
              onPress={handleEmail}>
              <Icon as={MailIcon} size="xl" color="$primary" />
              <Text size="md" color="$typography" marginStart="$3">
                {t("alarm.report.email")}
              </Text>
            </Pressable>

            {whatsappNumber && (
              <Pressable
                flexDirection="row"
                alignItems="center"
                minHeight={44}
                paddingHorizontal="$3"
                borderRadius="$6"
                onPress={handleWhatsApp}>
                <FontAwesome5 name="whatsapp" size={24} color="#25D366" />
                <Text size="md" color="$typography" marginStart="$3">
                  {t("alarm.report.whatsapp")}
                </Text>
              </Pressable>
            )}

            {telegramUsername && (
              <Pressable
                flexDirection="row"
                alignItems="center"
                minHeight={44}
                paddingHorizontal="$3"
                borderRadius="$6"
                onPress={handleTelegram}>
                <FontAwesome5 name="telegram-plane" size={24} color={theme.typography.val} />
                <Text size="md" color="$typography" marginStart="$3">
                  {t("alarm.report.telegram")}
                </Text>
              </Pressable>
            )}

            <Pressable
              flexDirection="row"
              alignItems="center"
              minHeight={44}
              paddingHorizontal="$3"
              borderRadius="$6"
              onPress={handleCopy}>
              <Icon as={ClipboardCopy} size="xl" color="$typographySecondary" />
              <Text size="md" color="$typography" marginStart="$3">
                {t("alarm.report.copyToClipboard")}
              </Text>
            </Pressable>
          </VStack>

          <Pressable
            marginTop="$4"
            minHeight={44}
            justifyContent="center"
            alignItems="center"
            onPress={onClose}>
            <Text size="sm" color="$typographySecondary">
              {t("common.cancel")}
            </Text>
          </Pressable>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ReportProblemModal;
