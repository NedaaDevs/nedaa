import { useCallback, useEffect, useRef } from "react";
import { BackHandler, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import { RTLContext, useRTL } from "@/contexts/RTLContext";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran");

interface ReaderBottomSheetProps {
  // Controlled by mount/unmount: the caller renders this while open; it presents on
  // mount and calls onClose when gorhom finishes dismissing (swipe, backdrop, back).
  open?: boolean;
  onClose: () => void;
  quranTheme: QuranThemeType;
  // Scrollable sheets get a fixed tall snap + a flex content area for an inner
  // BottomSheetScrollView. Non-scrollable sheets size to their content.
  scrollable?: boolean;
  // Identifies the sheet in the diagnostic log (present/settle/dismiss sequence).
  name?: string;
  // Swipe-down-to-close. Off while a sub-view is shown so the sub-view's own
  // drag-to-go-back owns the vertical gesture instead of dismissing the whole sheet.
  enablePanDownToClose?: boolean;
  children: React.ReactNode;
}

const SCROLL_SNAP_POINTS = ["85%"];

// Paper-themed reader bottom sheet on @gorhom/bottom-sheet. Owns all gorhom wiring:
// present/dismiss driven by `open`, swipe/backdrop dismiss, and Android hardware back
// (gorhom has none of its own). Stacks naturally — each open sheet is a modal in the
// provider's stack and its back handler wins by reverse-registration order.
const ReaderBottomSheet = ({
  open = true,
  onClose,
  quranTheme,
  scrollable = false,
  name = "sheet",
  enablePanDownToClose = true,
  children,
}: ReaderBottomSheetProps) => {
  const c = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const rtl = useRTL();
  const ref = useRef<BottomSheetModal>(null);

  // Drive present/dismiss off `open` so both mounting styles work: callers that
  // mount/unmount the sheet (open stays true) and callers that keep it mounted and
  // toggle `open`. Never dismiss before the first present — calling gorhom's
  // dismiss() on a never-presented modal wedges its state so the later present()
  // is swallowed. gorhom's onDismiss still fires onClose for swipe/backdrop/back.
  const hasPresented = useRef(false);
  // Set when gorhom dismisses the sheet itself (swipe/backdrop/back) — onDismiss has
  // already torn it down, so the open→false effect must NOT call dismiss() again. A
  // redundant dismiss() on an already-gone modal routes to the current top of the
  // stack and dismisses the wrong sheet (a stacked sub-sheet's parent).
  const dismissedBySheet = useRef(false);
  useEffect(() => {
    if (open) {
      hasPresented.current = true;
      log.d("sheet", `${name}: present()`);
      ref.current?.present();
    } else if (hasPresented.current) {
      if (dismissedBySheet.current) {
        dismissedBySheet.current = false;
      } else {
        log.d("sheet", `${name}: dismiss()`);
        ref.current?.dismiss();
      }
    }
  }, [open, name]);

  // Only while open: hardware back dismisses this sheet instead of navigating.
  // Returning true consumes the event; reverse-registration means a stacked top
  // sheet's handler runs first, so back pops one level at a time. Gating on `open`
  // keeps an always-mounted-but-closed sheet from swallowing back.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose={enablePanDownToClose}
      // While a sub-view is shown, its own drag-to-go-back owns vertical gestures, so
      // gorhom must not also drive the sheet from the handle or content.
      enableHandlePanningGesture={enablePanDownToClose}
      enableContentPanningGesture={enablePanDownToClose}
      onDismiss={() => {
        dismissedBySheet.current = true;
        log.d("sheet", `${name}: onDismiss`);
        onClose();
      }}
      // A present() with no following "index → 0" means the modal was swallowed
      // (a wedged provider) — the signature of the dead-sheet bug.
      onChange={(index) => log.d("sheet", `${name}: index → ${index}`)}
      // Keep lower sheets mounted/presented underneath (real stack). The default
      // "switch" minimizes the sheet below, firing its onDismiss → onClose, which
      // would unmount the action sheet (and its child Share sheet) on open.
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: c.background }}
      handleIndicatorStyle={{ backgroundColor: c.frameColor }}
      {...(scrollable
        ? { snapPoints: SCROLL_SNAP_POINTS, enableDynamicSizing: false }
        : { enableDynamicSizing: true })}>
      <RTLContext value={rtl}>
        {scrollable ? (
          // Fixed-height frame; the consumer's BottomSheetScrollView fills it.
          <View style={{ flex: 1, direction: rtl.direction, paddingHorizontal: 16 }}>
            {children}
          </View>
        ) : (
          // Fit-to-content: BottomSheetView reports its height so enableDynamicSizing
          // can size the sheet. A plain View doesn't measure and collapses to zero.
          <BottomSheetView
            style={{
              direction: rtl.direction,
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}>
            {children}
          </BottomSheetView>
        )}
      </RTLContext>
    </BottomSheetModal>
  );
};

export default ReaderBottomSheet;
