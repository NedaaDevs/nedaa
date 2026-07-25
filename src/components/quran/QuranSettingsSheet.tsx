import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { View, XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import QuickSettingsRow from "@/components/quran/settings/QuickSettingsRow";
import MushafSection from "@/components/quran/settings/MushafSection";
import ReaderOptionsSection from "@/components/quran/settings/ReaderOptionsSection";
import MaintenanceSection from "@/components/quran/settings/MaintenanceSection";

interface QuranSettingsSheetProps {
  onClose: () => void;
  onDownloadMore: () => void;
  onResetAll: () => Promise<void>;
}

const QuranSettingsSheet = ({ onClose, onDownloadMore, onResetAll }: QuranSettingsSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  // Dragging the header moves the sheet with the finger; past a threshold it
  // slides off and closes. Plain values (not useCallback/useMemo): the React
  // Compiler memoizes them, and keeping offset out of a hook dependency list
  // avoids the immutability rule that fires when a hook value is then mutated.
  const offset = useSharedValue(0);
  const drag = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onChange((e) => {
      "worklet";
      offset.value = Math.max(0, offset.value + e.changeY);
    })
    .onEnd((e) => {
      "worklet";
      if (offset.value > 96 || e.velocityY > 700) {
        offset.value = withTiming(400, { duration: 180 }, (done) => {
          if (done) scheduleOnRN(onClose);
        });
      } else {
        offset.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        exiting={reduceMotion ? undefined : FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        entering={reduceMotion ? undefined : SlideInDown.duration(240)}
        exiting={reduceMotion ? undefined : SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          sheetStyle,
          { backgroundColor: chrome.background, paddingBottom: insets.bottom + 8 },
        ]}>
        {/* The gesture covers the header only — on the whole sheet it would
            fight the inner ScrollView for vertical drags. */}
        <GestureDetector gesture={drag}>
          <YStack>
            <View
              alignSelf="center"
              width={36}
              height={4}
              borderRadius={2}
              backgroundColor={chrome.cardBorder}
              marginBottom="$3"
            />
            <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3">
              <Text fontSize={18} fontWeight="700" accessibilityRole="header">
                {t("quran.settings.title")}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                hitSlop={8}>
                <YStack
                  width={32}
                  height={32}
                  borderRadius={16}
                  backgroundColor={chrome.cardBorder}
                  alignItems="center"
                  justifyContent="center">
                  <X color={chrome.subtleText} size={16} />
                </YStack>
              </Pressable>
            </XStack>
          </YStack>
        </GestureDetector>

        <QuickSettingsRow chrome={chrome} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$5">
            <MushafSection chrome={chrome} onDownloadMore={onDownloadMore} onClose={onClose} />
            <ReaderOptionsSection chrome={chrome} />
            <MaintenanceSection chrome={chrome} onResetAll={onResetAll} />
          </YStack>
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 11,
  },
});

export default QuranSettingsSheet;
