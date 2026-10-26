import React, {
  createContext,
  createRef,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
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
  BackHandler,
  FlatList,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  View as RNView,
  type StyleProp,
  type ViewStyle,
  type FlatListProps,
  type HostInstance,
  type ViewInstance,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { BlurTargetView } from "expo-blur";
import { X } from "lucide-react-native";
import { useAppCovered, useCoverApp, useSheetLayer } from "@/components/ui/actionsheet/cover";
import { Icon } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { useElevationShadow } from "@/components/ui/material/edge";
import { Pressable, type PressableProps } from "@/components/ui/pressable";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { PlatformType } from "@/enums/app";
import { SHEET_CURVE, SHEET_MOTION, SPRING } from "@/constants/Motion";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";

/** The space step a tall sheet keeps below the status bar. */
const SHEET_TOP_GAP = "$5";

/** No size token sits at 5. */
const GRABBER_HEIGHT = 5;

/** The header's height: grabber plus the space above and below it. */
const headerHeight = () =>
  getTokenValue("$2", "space") + GRABBER_HEIGHT + getTokenValue("$3.5", "space");

/** Leaving: a timing on the iOS sheet curve. */
const LEAVE = { duration: SHEET_MOTION.DISMISS_MS, easing: Easing.bezier(...SHEET_CURVE) };

const REDUCED_FADE = { duration: SHEET_MOTION.REDUCED_FADE_MS };

const SCRIM_FADE = { duration: SHEET_MOTION.SCRIM_MS };

const HERO_FADE = { duration: SHEET_MOTION.HERO_FADE_MS };

/** gorhom's index for a sheet that is closed or closing. */
const CLOSED_INDEX = -1;

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** Test ids for the parts a test reaches. */
export const ACTIONSHEET_PART = {
  LAYER: "actionsheet-layer",
  CLOSE: "actionsheet-close",
  HEADER: "actionsheet-header",
  GRABBER: "actionsheet-grabber",
  BODY: "actionsheet-body",
  SCRIM: "actionsheet-scrim",
  HERO: "actionsheet-hero",
} as const;

/** Drawn in the top sheet's layer, where iOS lets a reader reach it. */
const ActionsheetOverlay = createContext<ReactNode>(null);

/** Where ActionsheetTitle registers its view for the sheet to focus. */
const TitleContext = createContext<RefObject<ViewInstance | null> | null>(null);

const NO_TITLE = createRef<ViewInstance>();

/** The sheet's title, for content that sends reader focus back to it. */
const useActionsheetTitle = (): RefObject<ViewInstance | null> => use(TitleContext) ?? NO_TITLE;

type BlurTarget = RefObject<ViewInstance | null>;

/** The content view whose pixels the header blurs on Android. */
const BlurTargetContext = createContext<BlurTarget | null>(null);

/**
 * gorhom's handle, drawn as the blurred header with the grabber. Its negative
 * margin gives it no room of its own, so it lies over the content's top.
 */
const SheetHeader = ({ blurTarget }: { blurTarget: BlurTarget }) => (
  <Material
    testID={ACTIONSHEET_PART.HEADER}
    material={MATERIAL.SHEET_HEADER}
    radius="sheet"
    blurTarget={blurTarget}
    height={headerHeight()}
    marginBottom={-headerHeight()}
    alignItems="center"
    paddingTop="$2"
    paddingBottom="$3.5"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    <View
      testID={ACTIONSHEET_PART.GRABBER}
      width="$9"
      height={GRABBER_HEIGHT}
      borderRadius="$pill"
      backgroundColor="$handle"
    />
  </Material>
);

type SheetScrimProps = {
  shown: SharedValue<number>;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The dimmed screen behind a sheet; a tap on it closes the sheet. */
const SheetScrim = ({ shown, onPress, style }: SheetScrimProps) => {
  const { t } = useTranslation();
  const scrim = useThemeColor("$scrim");
  const faded = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <AnimatedPressable
      testID={ACTIONSHEET_PART.SCRIM}
      style={[style, { backgroundColor: scrim }, faded]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.dismiss")}
    />
  );
};

type ModalLayerProps = PropsWithChildren<{ fade: SharedValue<number> }>;

// The app's sibling holding backdrop and sheet: VoiceOver stays inside it,
// and the escape gesture closes the top sheet.
const ModalLayer = ({ fade, children }: ModalLayerProps) => {
  const { dismiss } = useBottomSheetModal();
  const top = useSheetLayer();
  const overlay = use(ActionsheetOverlay);
  const faded = useAnimatedStyle(() => ({ opacity: fade.get() }));
  return (
    <Animated.View
      testID={ACTIONSHEET_PART.LAYER}
      style={[StyleSheet.absoluteFill, faded]}
      pointerEvents="box-none"
      accessibilityViewIsModal
      onAccessibilityEscape={() => dismiss()}>
      {children}
      {top ? overlay : null}
    </Animated.View>
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
  /** Gets screen-reader focus once the sheet is up; the title when unset or empty. */
  initialFocusRef?: RefObject<HostInstance | null>;
  children?: React.ReactNode;
};

const Actionsheet: React.FC<ActionsheetProps> = ({
  isOpen = false,
  onClose,
  snapPoints = [50],
  fitContent = false,
  finalFocusRef,
  initialFocusRef,
  children,
}) => {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const snapHaptic = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const shadow = useElevationShadow(ELEVATION_LEVEL.E3);
  // The whole layer's opacity; it moves only under Reduce Motion.
  const fade = useSharedValue(1);
  const scrim = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const title = useRef<ViewInstance>(null);
  const blurTarget = useRef<ViewInstance>(null);
  const hasPresented = useRef(false);
  const leaving = useRef(false);
  // Set once the sheet first settles; a later snap is the user's own move.
  const settled = useRef(false);
  // Up from its first settle until gorhom reports it dismissed.
  const [shown, setShown] = useState(false);
  useCoverApp(shown);
  const covered = useAppCovered();
  const points = useMemo(
    () => snapPoints.map((n) => (typeof n === "number" ? `${n}%` : n)),
    [snapPoints]
  );

  // Focus moves into the sheet once it is up, and back out after.
  useEffect(() => {
    if (!shown) return;
    focusOn(initialFocusRef?.current ?? title.current);
    return () => {
      leaving.current = true;
    };
  }, [shown, initialFocusRef]);

  // Waits for the app to be uncovered: until then the opener is out of reach.
  useEffect(() => {
    if (shown || covered || !leaving.current) return;
    leaving.current = false;
    focusOn(finalFocusRef?.current);
  }, [shown, covered, finalFocusRef]);

  // Under Reduce Motion the sheet fades in where it stands.
  const present = useEffectEvent(() => {
    hasPresented.current = true;
    fade.set(reduced ? 0 : 1);
    if (reduced) fade.set(withTiming(1, REDUCED_FADE));
    scrim.set(0);
    scrim.set(withTiming(1, SCRIM_FADE));
    ref.current?.present();
  });

  // Under Reduce Motion the sheet fades out, then goes at once.
  const leave = useEffectEvent(() => {
    if (!reduced) {
      ref.current?.dismiss(LEAVE);
      return;
    }
    fade.set(withTiming(0, REDUCED_FADE));
    const timer = setTimeout(() => ref.current?.dismiss(), SHEET_MOTION.REDUCED_FADE_MS);
    return () => clearTimeout(timer);
  });

  // Present on open; dismiss on a programmatic close only. hasPresented guards both
  // the never-dismiss-before-present case and the reopen case: gorhom's onDismiss
  // resets it, so a gorhom-initiated close (swipe/backdrop) doesn't trigger a
  // redundant dismiss() that would wedge the next present().
  useEffect(() => {
    if (isOpen) return present();
    if (hasPresented.current) return leave();
  }, [isOpen]);

  const handleChange = useCallback(
    (index: number) => {
      if (index <= CLOSED_INDEX) return;
      if (settled.current) void snapHaptic();
      settled.current = true;
      setShown(true);
    },
    [snapHaptic]
  );

  // Every way out starts here, so the scrim leaves on its own timing.
  const handleAnimate = useCallback(
    (_from: number, to: number) => {
      if (to === CLOSED_INDEX) scrim.set(withTiming(0, SCRIM_FADE));
    },
    [scrim]
  );

  const handleDismiss = useCallback(() => {
    hasPresented.current = false;
    settled.current = false;
    setShown(false);
    onClose?.();
  }, [onClose]);

  const dismissOnCurve = useCallback(() => ref.current?.dismiss(LEAVE), []);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissOnCurve();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, dismissOnCurve]);

  const renderHandle = useCallback(() => <SheetHeader blurTarget={blurTarget} />, []);

  const renderLayer = useCallback(
    ({ children: layer }: PropsWithChildren) => <ModalLayer fade={fade}>{layer}</ModalLayer>,
    [fade]
  );

  // The scrim colour carries its own alpha; the fade runs it from 0 to 1.
  const renderBackdrop = useCallback(
    ({ style }: BottomSheetBackdropProps) => (
      <SheetScrim shown={scrim} onPress={dismissOnCurve} style={style} />
    ),
    [scrim, dismissOnCurve]
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={fitContent ? undefined : points}
      enableDynamicSizing={fitContent}
      // A tall body stops below the status bar and scrolls.
      topInset={fitContent ? insets.top + getTokenValue(SHEET_TOP_GAP, "space") : undefined}
      enablePanDownToClose
      onChange={handleChange}
      onAnimate={handleAnimate}
      onDismiss={handleDismiss}
      animationConfigs={SPRING.SETTLE}
      overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.Never}
      // gorhom's defaults make the content one "Bottom Sheet" element.
      accessible={false}
      accessibilityLabel={null}
      accessibilityRole={null}
      containerComponent={renderLayer}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={{
        backgroundColor: theme.raised.val,
        // Set explicitly, or gorhom's own default applies.
        borderTopLeftRadius: getTokenValue("$sheet", "radius"),
        borderTopRightRadius: getTokenValue("$sheet", "radius"),
        boxShadow: shadow,
      }}>
      <TitleContext value={title}>
        <BlurTargetContext value={blurTarget}>{children}</BlurTargetContext>
      </TitleContext>
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
  // Android blurs only this view's pixels under the header.
  const blurTarget = use(BlurTargetContext);
  // The last control sits a step above the home indicator, never on it.
  const paddingBottom = Math.max(
    getTokenValue("$6", "space"),
    insets.bottom + getTokenValue("$2", "space")
  );
  // The scrollable must be the modal's content directly — gorhom doesn't scroll a
  // BottomSheetScrollView nested inside a BottomSheetView. So the content IS the
  // scroll view; ActionsheetScrollView below is a passthrough.
  return (
    // A tap on a row lands while the keyboard is up, not only closing it.
    <BottomSheetScrollView keyboardShouldPersistTaps="handled">
      <BlurTargetView
        ref={blurTarget}
        testID={ACTIONSHEET_PART.BODY}
        style={[
          // Starts at the header's foot and scrolls under it.
          { paddingTop: headerHeight() },
          unpadded
            ? undefined
            : { paddingHorizontal: getTokenValue("$screen", "space"), paddingBottom },
        ]}>
        {children}
      </BlurTargetView>
    </BottomSheetScrollView>
  );
};
ActionsheetContent.displayName = "ActionsheetContent";

// --- ActionsheetHero ---

/** A sheet's hero; it fades in as the sheet starts to rise. */
const ActionsheetHero = ({ children }: PropsWithChildren) => {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) opacity.set(withTiming(1, HERO_FADE));
  }, [reduced, opacity]);

  const faded = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View testID={ACTIONSHEET_PART.HERO} style={faded}>
      {children}
    </Animated.View>
  );
};

// --- ActionsheetTitle ---

/** The sheet's heading, text only; reader focus lands here once it is up. */
const ActionsheetTitle: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RNView ref={use(TitleContext)} accessible accessibilityRole="header">
    {children}
  </RNView>
);
ActionsheetTitle.displayName = "ActionsheetTitle";

// --- ActionsheetCloseButton ---

/** The sheet's own close control; the caller places it. */
const ActionsheetCloseButton = ({ onPress, ...placement }: PressableProps) => {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={ACTIONSHEET_PART.CLOSE}
      accessibilityRole="button"
      accessibilityLabel={t("common.close")}
      onPress={onPress}
      alignItems="center"
      justifyContent="center"
      borderRadius="$pill"
      pressStyle={{ opacity: 1, backgroundColor: "$pressed" }}
      {...placement}>
      <Icon as={X} size="md" strokeWidth={1.8} color="$muted" />
    </Pressable>
  );
};

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
  ActionsheetCloseButton,
  ActionsheetContent,
  ActionsheetOverlay,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetIcon,
  ActionsheetFlatList,
  ActionsheetHero,
  ActionsheetScrollView,
  ActionsheetTitle,
  useActionsheetTitle,
};
export type {
  ActionsheetProps,
  ActionsheetContentProps,
  ActionsheetItemProps,
  ActionsheetItemTextProps,
  ActionsheetIconProps,
};
