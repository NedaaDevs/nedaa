import { FC, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { openComposer } from "react-native-email-link";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "tamagui";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon, MailIcon } from "@/components/ui/icon";
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
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  // Present/dismiss off `isOpen`. Never dismiss before the first present (gorhom wedges
  // a never-presented modal); gorhom's onDismiss still fires onClose for swipe/backdrop.
  const hasPresented = useRef(false);
  useEffect(() => {
    if (isOpen) {
      hasPresented.current = true;
      ref.current?.present();
    } else if (hasPresented.current) {
      ref.current?.dismiss();
    }
  }, [isOpen]);

  // Android hardware back closes the sheet instead of navigating.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleEmail = async () => {
    onClose();
    try {
      const body = await getReportText();
      await openComposer({ to: supportEmail, subject: emailSubject, body });
    } catch (e) {
      console.error("Failed to open email:", e);
    }
  };

  const handleWhatsApp = async () => {
    if (!whatsappNumber) return;
    onClose();
    try {
      const summary = await getSummaryText();
      await Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open WhatsApp:", e);
    }
  };

  const handleTelegram = async () => {
    if (!telegramUsername) return;
    onClose();
    try {
      const summary = await getSummaryText();
      await Linking.openURL(`https://t.me/${telegramUsername}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open Telegram:", e);
    }
  };

  const handleCopy = async () => {
    onClose();
    await onCopy();
  };

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val }}
      handleIndicatorStyle={{
        backgroundColor: theme.typographySecondary?.val ?? theme.outline?.val,
      }}>
      <BottomSheetView
        style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <Text size="lg" fontWeight="600" color="$typography" textAlign="center" marginBottom="$4">
          {t("alarm.report.shareVia")}
        </Text>
        <VStack gap="$1">
          <Pressable
            minHeight={52}
            paddingHorizontal="$3"
            borderRadius="$4"
            onPress={handleEmail}
            accessibilityRole="button"
            accessibilityLabel={t("alarm.report.email")}>
            <HStack alignItems="center" width="100%" gap="$3">
              <Icon as={MailIcon} size="xl" color="$primary" />
              <Text size="md" color="$typography">
                {t("alarm.report.email")}
              </Text>
            </HStack>
          </Pressable>

          {whatsappNumber && (
            <Pressable
              minHeight={52}
              paddingHorizontal="$3"
              borderRadius="$4"
              onPress={handleWhatsApp}
              accessibilityRole="button"
              accessibilityLabel={t("alarm.report.whatsapp")}>
              <HStack alignItems="center" width="100%" gap="$3">
                <FontAwesome5 name="whatsapp" size={24} color="#25D366" />
                <Text size="md" color="$typography">
                  {t("alarm.report.whatsapp")}
                </Text>
              </HStack>
            </Pressable>
          )}

          {telegramUsername && (
            <Pressable
              minHeight={52}
              paddingHorizontal="$3"
              borderRadius="$4"
              onPress={handleTelegram}
              accessibilityRole="button"
              accessibilityLabel={t("alarm.report.telegram")}>
              <HStack alignItems="center" width="100%" gap="$3">
                <FontAwesome5 name="telegram-plane" size={24} color={theme.typography?.val} />
                <Text size="md" color="$typography">
                  {t("alarm.report.telegram")}
                </Text>
              </HStack>
            </Pressable>
          )}

          <Pressable
            minHeight={52}
            paddingHorizontal="$3"
            borderRadius="$4"
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={t("alarm.report.copyToClipboard")}>
            <HStack alignItems="center" width="100%" gap="$3">
              <Icon as={ClipboardCopy} size="xl" color="$typographySecondary" />
              <Text size="md" color="$typography">
                {t("alarm.report.copyToClipboard")}
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ReportProblemModal;
