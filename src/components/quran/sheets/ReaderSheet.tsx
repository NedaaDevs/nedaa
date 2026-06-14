import { View } from "react-native";
import { Sheet } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import { RTLContext, useRTL } from "@/contexts/RTLContext";

interface ReaderSheetProps {
  // Controlled visibility. Keep the component mounted and toggle `open` so the
  // sheet plays its exit animation. Defaults to open for callers that instead
  // mount/unmount the whole sheet (the exit is then immediate).
  open?: boolean;
  onClose: () => void;
  quranTheme: QuranThemeType;
  children: React.ReactNode;
}

// Paper-themed reader bottom sheet built on Tamagui's Sheet — native drag
// handle, safe-area and keyboard handling. `snapPointsMode="fit"` sizes the
// sheet to its content (works for the short surah card and the taller ayah sheet).
const ReaderSheet = ({ open = true, onClose, quranTheme, children }: ReaderSheetProps) => {
  const c = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const rtl = useRTL();

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      dismissOnOverlayPress
      moveOnKeyboardChange
      zIndex={100000}
      transition="smooth">
      <Sheet.Overlay
        transition="lazy"
        backgroundColor="rgba(0,0,0,0.45)"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Handle backgroundColor={c.frameColor} opacity={0.4} />
      <Sheet.Frame
        backgroundColor={c.background}
        borderTopLeftRadius="$7"
        borderTopRightRadius="$7"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom={Math.max(insets.bottom, 16) + 16}>
        <RTLContext value={rtl}>
          <View style={{ direction: rtl.direction }}>{children}</View>
        </RTLContext>
      </Sheet.Frame>
    </Sheet>
  );
};

export default ReaderSheet;
