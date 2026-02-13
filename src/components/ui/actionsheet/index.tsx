import React from "react";
import { styled, View, Text as TamaguiText, Sheet, useTheme } from "tamagui";
import type { GetProps } from "tamagui";
import { FlatList, ScrollView as RNScrollView } from "react-native";
import type { FlatListProps, ScrollViewProps } from "react-native";

// --- Actionsheet ---

type ActionsheetProps = {
  isOpen?: boolean;
  onClose?: () => void;
  snapPoints?: number[];
  children?: React.ReactNode;
};

const Actionsheet: React.FC<ActionsheetProps> = ({
  isOpen = false,
  onClose,
  snapPoints = [50],
  children,
}) => {
  return (
    <Sheet
      modal
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose?.();
      }}
      snapPoints={snapPoints}
      dismissOnSnapToBottom
      dismissOnOverlayPress>
      {children}
    </Sheet>
  );
};
Actionsheet.displayName = "Actionsheet";

// --- ActionsheetBackdrop ---

type ActionsheetBackdropProps = {
  opacity?: number;
  backgroundColor?: string;
};

const ActionsheetBackdrop: React.FC<ActionsheetBackdropProps> = ({
  backgroundColor = "rgba(0,0,0,0.5)",
  ...props
}) => {
  return <Sheet.Overlay backgroundColor={backgroundColor as any} {...props} />;
};
ActionsheetBackdrop.displayName = "ActionsheetBackdrop";

// --- ActionsheetContent ---

type ActionsheetContentProps = {
  children?: React.ReactNode;
};

const ActionsheetContent: React.FC<ActionsheetContentProps> = ({ children }) => {
  return (
    <Sheet.Frame
      backgroundColor="$backgroundSecondary"
      borderTopLeftRadius="$6"
      borderTopRightRadius="$6"
      paddingHorizontal="$5"
      paddingTop="$2"
      paddingBottom="$5">
      {children}
    </Sheet.Frame>
  );
};
ActionsheetContent.displayName = "ActionsheetContent";

// --- ActionsheetDragIndicatorWrapper ---

const ActionsheetDragIndicatorWrapper = styled(View, {
  name: "ActionsheetDragIndicatorWrapper",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: "$2",
});

// --- ActionsheetDragIndicator ---

const ActionsheetDragIndicator = styled(View, {
  name: "ActionsheetDragIndicator",
  width: 48,
  height: 4,
  borderRadius: 2,
  backgroundColor: "$backgroundMuted",
});

// --- ActionsheetItem ---

const ActionsheetItem = styled(View, {
  name: "ActionsheetItem",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  minHeight: 44,
  paddingVertical: "$3",
  paddingHorizontal: "$2",
  borderRadius: "$2",
  gap: "$3",
  pressStyle: {
    backgroundColor: "$backgroundMuted",
  },
});

// --- ActionsheetItemText ---

const ActionsheetItemText = styled(TamaguiText, {
  name: "ActionsheetItemText",
  fontFamily: "$body",
  fontSize: "$3",
  color: "$typography",
});

// --- ActionsheetIcon ---

type ActionsheetIconProps = {
  as: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
  color?: string;
};

const ActionsheetIcon: React.FC<ActionsheetIconProps> = ({
  as: IconComponent,
  size = 20,
  color: colorProp,
}) => {
  const theme = useTheme();

  const resolvedColor = colorProp
    ? colorProp.startsWith("$")
      ? ((theme as Record<string, { val: string }>)[colorProp.slice(1)]?.val ?? colorProp)
      : colorProp
    : theme.typography.val;

  return <IconComponent size={size} color={resolvedColor} />;
};
ActionsheetIcon.displayName = "ActionsheetIcon";

// --- ActionsheetFlatList ---
// Consumers use this as a plain FlatList (not inside an Actionsheet).

const ActionsheetFlatList = FlatList as React.ComponentType<FlatListProps<any>>;

// --- ActionsheetScrollView ---

const ActionsheetScrollView = RNScrollView as React.ComponentType<ScrollViewProps>;

// --- Types ---

type ActionsheetItemProps = GetProps<typeof ActionsheetItem>;
type ActionsheetItemTextProps = GetProps<typeof ActionsheetItemText>;
type ActionsheetDragIndicatorWrapperProps = GetProps<typeof ActionsheetDragIndicatorWrapper>;
type ActionsheetDragIndicatorProps = GetProps<typeof ActionsheetDragIndicator>;

export {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetIcon,
  ActionsheetFlatList,
  ActionsheetScrollView,
};
export type {
  ActionsheetProps,
  ActionsheetContentProps,
  ActionsheetItemProps,
  ActionsheetItemTextProps,
  ActionsheetDragIndicatorWrapperProps,
  ActionsheetDragIndicatorProps,
  ActionsheetIconProps,
};
