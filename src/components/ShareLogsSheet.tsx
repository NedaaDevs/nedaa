import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";
import { ClipboardCopy } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { MessageToast } from "@/components/feedback";
import { useRTL } from "@/contexts/RTLContext";
import { AppLogger } from "@/utils/appLogger";

interface ShareLogsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// "Report a problem" sheet: the user describes the issue in plain language; the
// diagnostic bundle (their note + on-device logs) is attached and sent via the OS
// share sheet. No log/crash jargon is shown.
const ShareLogsSheet: FC<ShareLogsSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const [description, setDescription] = useState("");

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

  const handleSend = () => {
    const opts = note();
    onClose();
    void AppLogger.shareReport(opts);
  };

  const handleCopy = async () => {
    const opts = note();
    onClose();
    await AppLogger.copyReport(opts);
    MessageToast.showInfo(t("settings.shareLogs.copied"));
  };

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

          <Button
            onPress={handleSend}
            width="100%"
            accessibilityRole="button"
            accessibilityLabel={t("settings.shareLogs.share")}>
            <Button.Text>{t("settings.shareLogs.share")}</Button.Text>
          </Button>

          <Pressable
            minHeight={44}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={t("alarm.report.copyToClipboard")}>
            <HStack alignItems="center" justifyContent="center" gap="$2">
              <Icon as={ClipboardCopy} size="sm" color="$typographySecondary" />
              <Text size="sm" color="$typographySecondary">
                {t("alarm.report.copyToClipboard")}
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ShareLogsSheet;
