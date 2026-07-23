import { useRef, useState } from "react";
import { View } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Share2, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Modal, ModalBackdrop, ModalContent, ModalCloseButton } from "@/components/ui/modal";
import StreakShareCard, { type StreakVariant } from "@/components/StreakShareCard";
import { captureAndShare } from "@/utils/shareCard";

interface StreakShareButtonProps {
  variant: StreakVariant;
  count: number;
}

// Share affordance for a streak: a compact icon button that opens a preview of
// the branded card, then captures the visible card and hands it to the OS share
// sheet. Capturing an on-screen (modal) view avoids off-screen clipping.
const StreakShareButton = ({ variant, count }: StreakShareButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await captureAndShare({
        ref: cardRef,
        fileName: `nedaa-${variant}-streak`,
        dialogTitle: t(`streakShare.${variant}.title`),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        accessibilityRole="button"
        accessibilityLabel={t("a11y.shareStreak")}
        accessibilityHint={t("a11y.shareStreakHint")}>
        <Icon as={Share2} size="sm" color="$typographySecondary" />
      </Pressable>

      <Modal isOpen={open} onClose={() => setOpen(false)} size="sm">
        <ModalBackdrop />
        <ModalContent>
          <ModalCloseButton onPress={() => setOpen(false)}>
            <Icon as={X} size="sm" color="$typographySecondary" />
          </ModalCloseButton>

          <YStack alignItems="center" gap="$4" paddingVertical="$6" paddingHorizontal="$4">
            {/* Visible capture target */}
            <View ref={cardRef} collapsable={false}>
              <StreakShareCard variant={variant} count={count} />
            </View>

            <XStack
              onPress={busy ? undefined : onShare}
              pressStyle={{ opacity: 0.85 }}
              accessibilityRole="button"
              accessibilityLabel={t("streakShare.shareAction")}
              accessibilityState={{ disabled: busy }}
              alignSelf="stretch"
              alignItems="center"
              justifyContent="center"
              gap="$2"
              minHeight={50}
              borderRadius={14}
              opacity={busy ? 0.6 : 1}
              backgroundColor="$primary">
              <Icon as={Share2} size="sm" color="$typographyContrast" />
              <Text fontSize={15} fontWeight="700" color="$typographyContrast">
                {t("streakShare.shareAction")}
              </Text>
            </XStack>
          </YStack>
        </ModalContent>
      </Modal>
    </>
  );
};

export default StreakShareButton;
