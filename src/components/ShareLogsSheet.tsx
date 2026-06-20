import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as MailComposer from "expo-mail-composer";
import { useTheme } from "tamagui";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { ClipboardCopy } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon, MailIcon } from "@/components/ui/icon";
import { MessageToast } from "@/components/feedback";
import { useRTL } from "@/contexts/RTLContext";
import { AppLogger } from "@/utils/appLogger";

interface ShareLogsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// "Report a problem" sheet: the user describes the issue in plain language, then picks
// a channel. Email attaches the full diagnostic file; WhatsApp/Telegram (which can't
// attach files) send a concise text summary (note + device + recent issues); Copy
// puts the full report on the clipboard. No log/crash jargon is shown.
const ShareLogsSheet: FC<ShareLogsSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const [description, setDescription] = useState("");

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  const hasPresented = useRef(false);
  useEffect(() => {
    if (isOpen) {
      hasPresented.current = true;
      ref.current?.present();
    } else if (hasPresented.current) {
      ref.current?.dismiss();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    setDescription("");
    onClose();
  }, [onClose]);

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

  const note = () => (description.trim() ? { description: description.trim() } : {});

  // Email: real attachment of the full report (falls back to the OS share sheet if no
  // mail account is configured).
  const handleEmail = async () => {
    const opts = note();
    onClose();
    try {
      const fileUri = await AppLogger.getReportFile(opts);
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: supportEmail ? [supportEmail] : undefined,
          subject: t("settings.shareLogs.emailSubject"),
          body: opts.description ?? "",
          attachments: fileUri ? [fileUri] : undefined,
        });
      } else {
        await AppLogger.shareReport(opts);
      }
    } catch (e) {
      console.error("Failed to compose email:", e);
    }
  };

  const handleWhatsApp = async () => {
    if (!whatsappNumber) return;
    const opts = note();
    onClose();
    try {
      const summary = await AppLogger.buildSummary(opts);
      await Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open WhatsApp:", e);
    }
  };

  const handleTelegram = async () => {
    if (!telegramUsername) return;
    const opts = note();
    onClose();
    try {
      const summary = await AppLogger.buildSummary(opts);
      await Linking.openURL(`https://t.me/${telegramUsername}?text=${encodeURIComponent(summary)}`);
    } catch (e) {
      console.error("Failed to open Telegram:", e);
    }
  };

  const handleCopy = async () => {
    const opts = note();
    onClose();
    await AppLogger.copyReport(opts);
    MessageToast.showInfo(t("settings.shareLogs.copied"));
  };

  const row = (label: string, icon: ReactNode, onPress: () => void) => (
    <Pressable
      minHeight={52}
      paddingHorizontal="$3"
      borderRadius="$4"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <HStack alignItems="center" width="100%" gap="$3">
        {icon}
        <Text size="md" color="$typography">
          {label}
        </Text>
      </HStack>
    </Pressable>
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={handleDismiss}
      enablePanDownToClose
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val }}
      handleIndicatorStyle={{
        backgroundColor: theme.typographySecondary?.val ?? theme.outline?.val,
      }}>
      <BottomSheetView
        style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <VStack gap="$3">
          <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
            {t("settings.shareLogs.label")}
          </Text>
          <Text size="sm" color="$typographySecondary" textAlign="center" lineHeight={20}>
            {t("settings.shareLogs.hint")}
          </Text>

          <BottomSheetTextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("settings.shareLogs.describe")}
            placeholderTextColor={theme.typographySecondary?.val}
            multiline
            style={{
              minHeight: 88,
              borderWidth: 1,
              borderColor: theme.outline?.val,
              borderRadius: 12,
              padding: 12,
              textAlignVertical: "top",
              textAlign: isRTL ? "right" : "left",
              color: theme.typography?.val,
              fontSize: 15,
            }}
          />

          <VStack gap="$1">
            {row(
              t("alarm.report.email"),
              <Icon as={MailIcon} size="xl" color="$primary" />,
              handleEmail
            )}
            {whatsappNumber
              ? row(
                  t("alarm.report.whatsapp"),
                  <FontAwesome5 name="whatsapp" size={24} color="#25D366" />,
                  handleWhatsApp
                )
              : null}
            {telegramUsername
              ? row(
                  t("alarm.report.telegram"),
                  <FontAwesome5 name="telegram-plane" size={24} color={theme.typography?.val} />,
                  handleTelegram
                )
              : null}
            {row(
              t("alarm.report.copyToClipboard"),
              <Icon as={ClipboardCopy} size="xl" color="$typographySecondary" />,
              handleCopy
            )}
          </VStack>
        </VStack>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ShareLogsSheet;
