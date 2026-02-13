import React from "react";
import { styled, View, XStack, YStack, Dialog } from "tamagui";
import type { GetProps } from "tamagui";
import { ScrollView } from "react-native";

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
  return (
    <ModalSizeContext.Provider value={size}>
      <Dialog
        modal
        open={isOpen}
        onOpenChange={(open: boolean) => {
          if (!open) onClose?.();
        }}>
        {isOpen && <Dialog.Portal>{children}</Dialog.Portal>}
      </Dialog>
    </ModalSizeContext.Provider>
  );
};
Modal.displayName = "Modal";

// --- ModalBackdrop ---

const ModalBackdrop: React.FC = () => {
  return <Dialog.Overlay key="modal-overlay" opacity={0.5} backgroundColor="rgba(0,0,0,0.5)" />;
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
  const size = React.useContext(ModalSizeContext);

  return (
    <Dialog.Content
      key="modal-content"
      backgroundColor="$backgroundSecondary"
      borderRadius="$6"
      padding="$0"
      width="90%"
      maxWidth={SIZE_MAX_WIDTH[size]}>
      {children}
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
  return <ScrollView style={{ paddingHorizontal: 20 }}>{children}</ScrollView>;
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
  return (
    <Dialog.Close asChild>
      <View
        role="button"
        accessibilityLabel="Close"
        position="absolute"
        top="$2"
        right="$2"
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
