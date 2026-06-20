import { FC, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";
import { Share2, ClipboardCopy } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { MessageToast } from "@/components/feedback";
import { AppLogger } from "@/utils/appLogger";

interface ShareLogsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Bottom sheet for sharing the on-device diagnostic logs: "Share file" opens the OS
// share sheet with the .log attached; "Copy" puts the bundle text on the clipboard.
const ShareLogsSheet: FC<ShareLogsSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

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

  const handleShare = () => {
    onClose();
    void AppLogger.shareReport();
  };

  const handleCopy = async () => {
    onClose();
    await AppLogger.copyReport();
    MessageToast.showInfo(t("settings.shareLogs.copied"));
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
          {t("settings.shareLogs.label")}
        </Text>
        <VStack gap="$1">
          <Pressable
            minHeight={52}
            paddingHorizontal="$3"
            borderRadius="$4"
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t("settings.shareLogs.share")}>
            <HStack alignItems="center" width="100%" gap="$3">
              <Icon as={Share2} size="xl" color="$primary" />
              <Text size="md" color="$typography">
                {t("settings.shareLogs.share")}
              </Text>
            </HStack>
          </Pressable>

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

export default ShareLogsSheet;
