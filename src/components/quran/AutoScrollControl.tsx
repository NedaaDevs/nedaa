import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { MotiView } from "moti";
import { Play, Pause } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { AutoScrollSpeed, QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

// Floating auto-scroll control for the vertical continuous reader: three
// tap-through speed presets and one large play/pause button (no sliders or hidden
// gestures). Fades out while gliding and returns on a screen tap, via `visible`.

const SPEEDS: { value: AutoScrollSpeed; labelKey: string }[] = [
  { value: AutoScrollSpeed.SLOW, labelKey: "quran.autoScroll.slow" },
  { value: AutoScrollSpeed.MEDIUM, labelKey: "quran.autoScroll.medium" },
  { value: AutoScrollSpeed.FAST, labelKey: "quran.autoScroll.fast" },
];

const AutoScrollControl = ({
  quranTheme,
  visible,
}: {
  quranTheme: QuranThemeType;
  visible: boolean;
}) => {
  const { t } = useTranslation();
  const colors = QURAN_THEME_COLORS[quranTheme];

  const playing = useQuranStore((s) => s.autoScrollPlaying);
  const speed = useQuranStore((s) => s.autoScrollSpeed);
  const toggle = useQuranStore((s) => s.toggleAutoScroll);
  const setSpeed = useQuranStore((s) => s.setAutoScrollSpeed);

  return (
    <MotiView
      // Fade + lift out while hidden; ignore touches then so taps reach the reader.
      animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 8 }}
      transition={{ type: "timing", duration: 180 }}
      pointerEvents={visible ? "auto" : "none"}>
      <XStack
        alignItems="center"
        gap="$1.5"
        paddingLeft="$1.5"
        paddingRight="$1"
        paddingVertical="$1"
        borderRadius={999}
        backgroundColor={`${colors.background}F5`}
        borderWidth={1}
        borderColor={colors.frameColor}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 5,
        }}>
        <XStack alignItems="center" gap="$1">
          {SPEEDS.map(({ value, labelKey }) => {
            const active = value === speed;
            return (
              <Pressable
                key={value}
                onPress={() => setSpeed(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t("a11y.quran.autoScrollSpeed", { speed: t(labelKey) })}
                hitSlop={6}
                style={{ minHeight: 40, justifyContent: "center" }}>
                <YStack
                  paddingHorizontal="$2.5"
                  paddingVertical="$1.5"
                  borderRadius={999}
                  backgroundColor={active ? colors.headerColor : "transparent"}>
                  <Text
                    fontSize={13}
                    fontWeight="700"
                    color={active ? colors.background : colors.headerColor}>
                    {t(labelKey)}
                  </Text>
                </YStack>
              </Pressable>
            );
          })}
        </XStack>

        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ selected: playing }}
          accessibilityLabel={t(
            playing ? "a11y.quran.autoScrollPause" : "a11y.quran.autoScrollPlay"
          )}
          accessibilityHint={t("a11y.quran.autoScrollHint")}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.headerColor,
          }}>
          {playing ? (
            <Pause size={22} color={colors.background} fill={colors.background} />
          ) : (
            <Play size={22} color={colors.background} fill={colors.background} />
          )}
        </Pressable>
      </XStack>
    </MotiView>
  );
};

export default AutoScrollControl;
