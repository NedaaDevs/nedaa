import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react";
import { getTokenValue, styled, View, Text as TamaguiText } from "tamagui";
import { useTranslation } from "react-i18next";
import { useTheme, useThemeColor } from "@/components/ui/theme-color";
import { useTextScale } from "@/hooks/useTextScale";
import type { GetProps } from "tamagui";
import {
  AccessibilityInfo,
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  View as RNView,
  type FlatListProps,
  type HostInstance,
} from "react-native";
import { Easing, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  useBottomSheetModal,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useAppCovered, useCoverApp, useSheetLayer } from "@/components/ui/actionsheet/cover";
import { PlatformType } from "@/enums/app";
import { DURATION_MS, SHEET_CURVE } from "@/constants/Motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** The $sheet radius, as a number: gorhom styles take no theme tokens. */
const SHEET_RADIUS = 18;

/** Test ids for the parts a test reaches. */
export const ACTIONSHEET_PART = { LAYER: "actionsheet-layer" } as const;

/** Moves screen-reader focus to a view, when there is one. */
const focusOn = (node: HostInstance | null | undefined) => {
  if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
};

/** Drawn in the top sheet's layer, where iOS lets a reader reach it. */
const ActionsheetOverlay = createContext<ReactNode>(null);

/** Where ActionsheetTitle registers its view for the sheet to focus. */
const TitleContext = createContext<RefObject<RNView | null> | null>(null);

// The app's sibling holding backdrop and sheet: VoiceOver stays inside it,
// and the escape gesture closes the top sheet.
const ModalLayer = ({ children }: PropsWithChildren) => {
  const { dismiss } = useBottomSheetModal();
  const top = useSheetLayer();
  const overlay = use(ActionsheetOverlay);
  return (
    <RNView
      testID={ACTIONSHEET_PART.LAYER}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      accessibilityViewIsModal
      onAccessibilityEscape={() => dismiss()}>
      {children}
      {top ? overlay : null}
    </RNView>
  );
};

// --- Actionsheet ---
// Built on @gorhom/bottom-sheet so an inner ActionsheetScrollView scrolls instead of
// dragging the whole sheet. `isOpen` is bridged to present/dismiss; gorhom supplies
// the backdrop and handle, so ActionsheetBackdrop/DragIndicator render nothing.

type ActionsheetProps = {
  isOpen?: boolean;
  onClose?: () => void;
  /** A number is a percentage of the screen; a string passes to gorhom as written. */
  snapPoints?: (number | string)[];
  /** Sizes the sheet to its content instead of a detent. */
  fitContent?: boolean;
  /** Gets screen-reader focus back once the sheet closes: its opener. */
  finalFocusRef?: RefObject<HostInstance | null>;
  children?: React.ReactNode;
};

const Actionsheet: React.FC<ActionsheetProps> = ({
  isOpen = false,
  onClose,
  snapPoints = [50],
  fitContent = false,
  finalFocusRef,
  children,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const slide = useBottomSheetTimingConfigs({
    duration: DURATION_MS.GENTLE,
    easing: Easing.bezier(...SHEET_CURVE),
  });
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const title = useRef<RNView>(null);
  const hasPresented = useRef(false);
  const leaving = useRef(false);
  // Up from its first settle until gorhom reports it dismissed.
  const [shown, setShown] = useState(false);
  useCoverApp(shown);
  const covered = useAppCovered();
  const points = useMemo(
    () => snapPoints.map((n) => (typeof n === "number" ? `${n}%` : n)),
    [snapPoints]
  );

  // Focus moves to the title once the sheet is up, and back out after.
  useEffect(() => {
    if (!shown) return;
    focusOn(title.current);
    return () => {
      leaving.current = true;
    };
  }, [shown]);

  // Waits for the app to be uncovered: until then the opener is out of reach.
  useEffect(() => {
    if (shown || covered || !leaving.current) return;
    leaving.current = false;
    focusOn(finalFocusRef?.current);
  }, [shown, covered, finalFocusRef]);

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

  const handleChange = useCallback((index: number) => {
    if (index >= 0) setShown(true);
  }, []);

  const handleDismiss = useCallback(() => {
    hasPresented.current = false;
    setShown(false);
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
        // The scrim colour carries its own alpha.
        opacity={1}
        style={{ backgroundColor: theme.scrim.val }}
        pressBehavior="close"
        accessibilityLabel={t("common.close")}
      />
    ),
    [t, theme.scrim.val]
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={fitContent ? undefined : points}
      enableDynamicSizing={fitContent}
      // A tall body stops below the status bar and scrolls.
      topInset={fitContent ? insets.top + getTokenValue("$section", "space") : undefined}
      enablePanDownToClose
      onChange={handleChange}
      onDismiss={handleDismiss}
      animationConfigs={slide}
      overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.Never}
      // gorhom's defaults make the content one "Bottom Sheet" element.
      accessible={false}
      accessibilityLabel={null}
      accessibilityRole={null}
      containerComponent={ModalLayer}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.raised.val,
        // $sheet. Set explicitly, or gorhom's own default applies.
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
        // No shadow token exists; offset and blur are the design's.
        boxShadow: `0 -16px 44px ${theme.shadow.val}`,
      }}
      handleStyle={{
        paddingTop: getTokenValue("$2.5", "space"),
        paddingBottom: getTokenValue("$1", "space"),
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.handle.val,
        width: getTokenValue("$10", "size"),
        // No size token sits at 5.
        height: 5,
        borderRadius: getTokenValue("$pill", "radius"),
      }}>
      <TitleContext value={title}>{children}</TitleContext>
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
  /** Lets the content draw its own insets, for a full-bleed list or media. */
  unpadded?: boolean;
};

const ActionsheetContent: React.FC<ActionsheetContentProps> = ({ children, unpadded }) => {
  const insets = useSafeAreaInsets();
  // The last control sits a step above the home indicator, never on it.
  const paddingBottom = Math.max(
    getTokenValue("$6", "space"),
    insets.bottom + getTokenValue("$2", "space")
  );
  // The scrollable must be the modal's content directly — gorhom doesn't scroll a
  // BottomSheetScrollView nested inside a BottomSheetView. So the content IS the
  // scroll view; ActionsheetScrollView below is a passthrough.
  return (
    <BottomSheetScrollView
      contentContainerStyle={
        unpadded
          ? undefined
          : {
              paddingHorizontal: getTokenValue("$group", "space"),
              paddingTop: getTokenValue("$2", "space"),
              paddingBottom,
            }
      }>
      {children}
    </BottomSheetScrollView>
  );
};
ActionsheetContent.displayName = "ActionsheetContent";

// --- ActionsheetTitle ---

/** The sheet's heading, text only; reader focus lands here once it is up. */
const ActionsheetTitle: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RNView ref={use(TitleContext)} accessible accessibilityRole="header">
    {children}
  </RNView>
);
ActionsheetTitle.displayName = "ActionsheetTitle";

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

const ActionsheetItemTextFrame = styled(TamaguiText, {
  name: "ActionsheetItemText",
  fontFamily: "$body",
  color: "$typography",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 4 }),
});

// Item copy is 14px ($3) chrome; the app text-scale multiplies it and the OS
// scale stays off (the app owns text size).
const ITEM_FONT_SIZE = 14;

type ActionsheetItemTextWrapperProps = GetProps<typeof ActionsheetItemTextFrame>;

const ActionsheetItemText = React.forwardRef<
  React.ComponentRef<typeof ActionsheetItemTextFrame>,
  ActionsheetItemTextWrapperProps
>(({ fontSize, ...props }, ref) => {
  const m = useTextScale();
  const base = typeof fontSize === "number" ? fontSize : ITEM_FONT_SIZE;
  return (
    <ActionsheetItemTextFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />
  );
});
ActionsheetItemText.displayName = "ActionsheetItemText";

// --- ActionsheetIcon ---

type ActionsheetIconProps = {
  as: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
  color?: string;
};

const ActionsheetIcon: React.FC<ActionsheetIconProps> = ({
  as: IconComponent,
  size = 20,
  color = "$typography",
}) => <IconComponent size={size} color={useThemeColor(color)} />;
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
type ActionsheetItemTextProps = ActionsheetItemTextWrapperProps;

export {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetOverlay,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetIcon,
  ActionsheetFlatList,
  ActionsheetScrollView,
  ActionsheetTitle,
};
export type {
  ActionsheetProps,
  ActionsheetContentProps,
  ActionsheetItemProps,
  ActionsheetItemTextProps,
  ActionsheetIconProps,
};
