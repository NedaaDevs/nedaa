import { FC, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, BackHandler, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { openComposer } from "react-native-email-link";
import * as MailComposer from "expo-mail-composer";
import * as Clipboard from "expo-clipboard";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "tamagui";
import { Send, Share2, ClipboardCopy } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon, MailIcon } from "@/components/ui/icon";
import { MessageToast } from "@/components/feedback";
import { useRTL } from "@/contexts/RTLContext";
import { AppLogger } from "@/utils/appLogger";
import { submitFeedback, generateClientKey, utf8ByteLength } from "@/services/feedback";
import { Report, Attachment, type ReportType, type OutgoingAttachment } from "@/types/feedback";

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSubject: string;
  // Full report text (used for the email attachment, the shared .log file, and copy).
  getReportText: () => Promise<string>;
  // Short text summary (email body + WhatsApp/Telegram, which can't attach a file).
  getSummaryText: () => Promise<string>;
  // Base name for the generated .log file (e.g. "alarm", "audio", "report").
  baseName?: string;
  // `area` tag sent with a direct submission (e.g. "alarms", "athkar") — lets the
  // backend route the report without the user picking it manually.
  feedbackArea?: string;
  // Report type for a direct submission — "report a problem" is a bug by definition.
  feedbackType?: ReportType;
  // Deprecated/ignored — Copy now uses getReportText so the user's note is included.
  // Kept optional so existing callers that still pass it type-check.
  onCopy?: () => Promise<void> | void;
}

type SubmitStatus = "idle" | "submitting" | "error";

// One reusable "Report a problem" bottom sheet (alarm, athkar audio, app logs). The
// user describes the issue; the primary action submits directly to Nedaa's servers
// (same backend as Settings → Feedback). Other channels stay available below it:
// Email attaches the full .log + a summary body, "Share file" sends the .log via the
// OS sheet, WhatsApp/Telegram send the summary text (no file), Copy puts the full
// report on the clipboard.
const ReportProblemModal: FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  emailSubject,
  getReportText,
  getSummaryText,
  baseName = "report",
  feedbackArea,
  feedbackType = Report.BUG,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const [description, setDescription] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

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
    setSubmitStatus("idle");
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

  // Build the full report and short summary, threading the user's note into both.
  const compose = async () => {
    const desc = description.trim();
    const [report, summary] = await Promise.all([getReportText(), getSummaryText()]);
    return {
      full: desc ? `User note:\n${desc}\n\n${report}` : report,
      sum: desc ? `${desc}\n\n${summary}` : summary,
    };
  };

  // Primary action: post straight to Nedaa's servers (same backend as Settings →
  // Feedback), skipping the OS share sheet entirely. Stays open on failure so the
  // user can retry or fall back to one of the channels below instead.
  const handleDirectSubmit = async () => {
    setSubmitStatus("submitting");
    try {
      const { full, sum } = await compose();
      const attachment: OutgoingAttachment = {
        kind: Attachment.LOGS,
        mime: "text/plain",
        bytes: utf8ByteLength(full),
        body: full,
      };
      await submitFeedback({
        type: feedbackType,
        message: sum,
        area: feedbackArea,
        attachments: [attachment],
        clientKey: generateClientKey(),
      });
      setSubmitStatus("idle");
      MessageToast.showSuccess(t("settings.shareLogs.submitted"));
      onClose();
    } catch (e) {
      console.error("Failed to submit report directly:", e);
      setSubmitStatus("error");
    }
  };

  const handleEmail = async () => {
    onClose();
    try {
      const { full, sum } = await compose();
      const uri = AppLogger.writeReport(full, baseName);
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: supportEmail ? [supportEmail] : undefined,
          subject: emailSubject,
          body: sum,
          attachments: [uri],
        });
      } else {
        // No mail account configured — open a mail link with the summary in the body.
        await openComposer({ to: supportEmail, subject: emailSubject, body: sum });
      }
    } catch (e) {
      console.error("Failed to compose email:", e);
    }
  };

  const handleShareFile = async () => {
    onClose();
    try {
      const { full } = await compose();
      await AppLogger.shareText(full, baseName);
    } catch (e) {
      console.error("Failed to share file:", e);
    }
  };

  const handleWhatsApp = async () => {
    if (!whatsappNumber) return;
    onClose();
    try {
      const { sum } = await compose();
      await Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(sum)}`);
    } catch (e) {
      console.error("Failed to open WhatsApp:", e);
    }
  };

  const handleTelegram = async () => {
    if (!telegramUsername) return;
    onClose();
    try {
      const { sum } = await compose();
      await Linking.openURL(`https://t.me/${telegramUsername}?text=${encodeURIComponent(sum)}`);
    } catch (e) {
      console.error("Failed to open Telegram:", e);
    }
  };

  const handleCopy = async () => {
    onClose();
    try {
      const { full } = await compose();
      await Clipboard.setStringAsync(full);
      MessageToast.showInfo(t("settings.shareLogs.copied"));
    } catch (e) {
      console.error("Failed to copy report:", e);
    }
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

          <Pressable
            minHeight={52}
            paddingHorizontal="$4"
            borderRadius="$4"
            backgroundColor="$accentPrimary"
            opacity={submitStatus === "submitting" ? 0.7 : 1}
            onPress={submitStatus === "submitting" ? undefined : handleDirectSubmit}
            accessibilityRole="button"
            accessibilityLabel={t(
              submitStatus === "submitting"
                ? "settings.shareLogs.sending"
                : "settings.shareLogs.submitDirect"
            )}
            accessibilityState={{ disabled: submitStatus === "submitting" }}>
            <HStack alignItems="center" justifyContent="center" width="100%" gap="$2">
              {submitStatus === "submitting" ? (
                <ActivityIndicator size="small" color={theme.typographyContrast?.val} />
              ) : (
                <Icon as={Send} size="lg" color="$typographyContrast" />
              )}
              <Text size="md" fontWeight="700" color="$typographyContrast">
                {t(
                  submitStatus === "submitting"
                    ? "settings.shareLogs.sending"
                    : "settings.shareLogs.submitDirect"
                )}
              </Text>
            </HStack>
          </Pressable>

          {submitStatus === "error" && (
            <Text size="xs" color="$error" textAlign="center" accessibilityLiveRegion="assertive">
              {t("settings.shareLogs.submitFailed")}
            </Text>
          )}

          <Text size="xs" color="$typographySecondary" textAlign="center">
            {t("settings.shareLogs.orShareVia")}
          </Text>

          <VStack gap="$1">
            {row(
              t("alarm.report.email"),
              <Icon as={MailIcon} size="xl" color="$primary" />,
              handleEmail
            )}
            {row(
              t("settings.shareLogs.share"),
              <Icon as={Share2} size="xl" color="$primary" />,
              handleShareFile
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

export default ReportProblemModal;
