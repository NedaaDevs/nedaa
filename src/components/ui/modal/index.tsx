import React, { use } from "react";
import { styled, View, XStack, YStack, Dialog } from "tamagui";
import type { GetProps } from "tamagui";
import { ScrollView, View as RNView } from "react-native";
import { useTranslation } from "react-i18next";

import { RTLContext, useRTL } from "@/contexts/RTLContext";

// --- Modal size context ---

type ModalSize = "xs" | "sm" | "md" | "lg" | "full";

const ModalSizeContext = React.createContext<ModalSize>("md");

// --- Modal ---

type ModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
  size?: ModalSize;
  children?: React.ReactNode;
};

const Modal: React.FC<ModalProps> = ({ isOpen = false, onClose, size = "md", children }) => {
  // Read here, above the portal, where the app's providers are still in scope.
  const rtl = useRTL();

  return (
    <Dialog
      modal
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose?.();
      }}>
      {isOpen && (
        <Dialog.Portal>
          {/* A portal renders outside this subtree, so contexts are re-provided inside
              it — otherwise ModalContent silently falls back to the defaults. */}
          <ModalSizeContext value={size}>
            <RTLContext value={rtl}>{children}</RTLContext>
          </ModalSizeContext>
        </Dialog.Portal>
      )}
    </Dialog>
  );
};
Modal.displayName = "Modal";

// --- ModalBackdrop ---

const ModalBackdrop: React.FC = () => {
  return <Dialog.Overlay key="modal-overlay" backgroundColor="rgba(0,0,0,0.5)" />;
};
ModalBackdrop.displayName = "ModalBackdrop";

// --- ModalContent ---

const SIZE_MAX_WIDTH: Record<ModalSize, number | string> = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  full: "95%",
};

type ModalContentProps = {
  children?: React.ReactNode;
};

const ModalContent: React.FC<ModalContentProps> = ({ children }) => {
  const size = use(ModalSizeContext);
  const { direction } = useRTL();

  return (
    <Dialog.Content
      key="modal-content"
      backgroundColor="$backgroundSecondary"
      borderRadius="$6"
      padding="$0"
      width="90%"
      maxWidth={SIZE_MAX_WIDTH[size]}>
      {/* RTLProvider's direction wrapper is a native view and does not reach a portal. */}
      <RNView style={{ direction, width: "100%" }}>{children}</RNView>
    </Dialog.Content>
  );
};
ModalContent.displayName = "ModalContent";

// --- ModalHeader ---

const ModalHeader = styled(XStack, {
  name: "ModalHeader",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: "$5",
  paddingTop: "$5",
  paddingBottom: "$3",
});

// --- ModalBody ---

type ModalBodyProps = {
  children?: React.ReactNode;
};

const ModalBody: React.FC<ModalBodyProps> = ({ children }) => {
  return (
    <ScrollView>
      <YStack paddingHorizontal="$5">{children}</YStack>
    </ScrollView>
  );
};
ModalBody.displayName = "ModalBody";

// --- ModalFooter ---

const ModalFooter = styled(YStack, {
  name: "ModalFooter",
  paddingHorizontal: "$5",
  paddingBottom: "$5",
  paddingTop: "$3",
  borderTopWidth: 1,
  borderColor: "$outline",
});

// --- ModalCloseButton ---

type ModalCloseButtonProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: any;
};

const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({ children, onPress, style }) => {
  const { t } = useTranslation();
  return (
    <Dialog.Close asChild>
      <View
        role="button"
        accessibilityLabel={t("common.close")}
        position="absolute"
        top="$2"
        end={8}
        zIndex={10}
        minWidth={44}
        minHeight={44}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.7 }}
        hitSlop={8}
        onPress={onPress}
        style={style}>
        {children}
      </View>
    </Dialog.Close>
  );
};
ModalCloseButton.displayName = "ModalCloseButton";

// --- Types ---

type ModalHeaderProps = GetProps<typeof ModalHeader>;
type ModalFooterProps = GetProps<typeof ModalFooter>;

export {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
};
export type {
  ModalProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalCloseButtonProps,
  ModalSize,
};
