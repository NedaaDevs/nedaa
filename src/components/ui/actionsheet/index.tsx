import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { styled, View, Text as TamaguiText, useTheme } from "tamagui";
import type { GetProps } from "tamagui";
import { BackHandler, FlatList, Platform } from "react-native";
import type { FlatListProps } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { PlatformType } from "@/enums/app";

// --- Actionsheet ---
// Built on @gorhom/bottom-sheet so an inner ActionsheetScrollView scrolls instead of
// dragging the whole sheet. `isOpen` is bridged to present/dismiss; gorhom supplies
// the backdrop and handle, so ActionsheetBackdrop/DragIndicator render nothing.

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
  const theme = useTheme();
  const ref = useRef<BottomSheetModal>(null);
  const hasPresented = useRef(false);
  const points = useMemo(() => snapPoints.map((n) => `${n}%`), [snapPoints]);

  // Present on open; dismiss on a programmatic close only. hasPresented guards both
  // the never-dismiss-before-present case and the reopen case: gorhom's onDismiss
  // resets it, so a gorhom-initiated close (swipe/backdrop) doesn't trigger a
  // redundant dismiss() that would wedge the next present().
  useEffect(() => {
    if (isOpen) {
      hasPresented.current = true;
      ref.current?.present();
    } else if (hasPresented.current) {
      ref.current?.dismiss();
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    hasPresented.current = false;
    onClose?.();
  }, [onClose]);

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
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.backgroundSecondary?.val }}
      handleIndicatorStyle={{ backgroundColor: theme.backgroundMuted?.val }}>
      {children}
    </BottomSheetModal>
  );
};
Actionsheet.displayName = "Actionsheet";

// --- ActionsheetBackdrop ---
// gorhom renders the backdrop from the modal config, so the child is a no-op kept
// for API compatibility with existing consumers.

const ActionsheetBackdrop: React.FC = () => null;
ActionsheetBackdrop.displayName = "ActionsheetBackdrop";

// --- ActionsheetContent ---

type ActionsheetContentProps = {
  children?: React.ReactNode;
};

const ActionsheetContent: React.FC<ActionsheetContentProps> = ({ children }) => {
  // The scrollable must be the modal's content directly — gorhom doesn't scroll a
  // BottomSheetScrollView nested inside a BottomSheetView. So the content IS the
  // scroll view; ActionsheetScrollView below is a passthrough.
  return (
    <BottomSheetScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
      {children}
    </BottomSheetScrollView>
  );
};
ActionsheetContent.displayName = "ActionsheetContent";

// --- ActionsheetDragIndicatorWrapper / ActionsheetDragIndicator ---
// gorhom renders the drag handle, so these are no-ops kept for API compatibility.

const ActionsheetDragIndicatorWrapper: React.FC<{ children?: React.ReactNode }> = () => null;
ActionsheetDragIndicatorWrapper.displayName = "ActionsheetDragIndicatorWrapper";

const ActionsheetDragIndicator: React.FC = () => null;
ActionsheetDragIndicator.displayName = "ActionsheetDragIndicator";

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
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 4 }),
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
// A plain FlatList for consumers that render a list outside an Actionsheet sheet.

const ActionsheetFlatList = FlatList as React.ComponentType<FlatListProps<any>>;

// --- ActionsheetScrollView ---
// Passthrough: ActionsheetContent is already the BottomSheetScrollView, so this
// just renders its children inline (kept for API compatibility with consumers).

const ActionsheetScrollView: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
ActionsheetScrollView.displayName = "ActionsheetScrollView";

// --- Types ---

type ActionsheetItemProps = GetProps<typeof ActionsheetItem>;
type ActionsheetItemTextProps = GetProps<typeof ActionsheetItemText>;

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
  ActionsheetIconProps,
};
