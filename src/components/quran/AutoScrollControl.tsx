import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { MotiView } from "moti";
import { Play, Pause, Minus, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranThemeType } from "@/enums/quran";
import { AUTO_SCROLL_SPEED_LEVELS as LEVELS, QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { usePreferencesStore } from "@/stores/preferences";

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 8,
  elevation: 5,
} as const;

// Floating auto-scroll control for the continuous reader: a dot meter nudged with
// −/+ (no sliders or hidden gestures) plus play/pause. By default a slim one-row
// pill; the "Larger controls" accessibility preference swaps in a big labelled card.
// Follows the reader chrome via `visible`; pressing play switches to vertical.
const AutoScrollControl = ({
  quranTheme,
  visible,
}: {
  quranTheme: QuranThemeType;
  visible: boolean;
}) => {
  const { t } = useTranslation();
  const colors = QURAN_THEME_COLORS[quranTheme];
  const big = usePreferencesStore((s) => s.largeControls);

  const playing = useQuranStore((s) => s.autoScrollPlaying);
  const speed = useQuranStore((s) => s.autoScrollSpeed);
  const toggle = useQuranStore((s) => s.toggleAutoScroll);
  const setSpeed = useQuranStore((s) => s.setAutoScrollSpeed);

  // Nearest level to the stored pace, so a migrated/fine value still lights a dot.
  const level = LEVELS.reduce(
    (best, v, i) => (Math.abs(v - speed) < Math.abs(LEVELS[best] - speed) ? i : best),
    0
  );
  const setLevel = (i: number) => setSpeed(LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))]);

  const stepBtn = (icon: typeof Minus, delta: number, label: string, disabled: boolean) => {
    const Icon = icon;
    const size = big ? 48 : 34;
    return (
      <Pressable
        onPress={() => setLevel(level + delta)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={8}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: big ? 2 : 1.5,
          borderColor: colors.frameColor,
          opacity: disabled ? 0.35 : 1,
        }}>
        <Icon size={big ? 24 : 16} color={colors.headerColor} />
      </Pressable>
    );
  };

  const meter = () => (
    <XStack alignItems="center" gap={big ? "$1.5" : "$1"}>
      {LEVELS.map((_, i) => {
        const filled = i <= level;
        const on = big ? 14 : 9;
        const off = big ? 10 : 6;
        return (
          <YStack
            key={i}
            width={filled ? on : off}
            height={filled ? on : off}
            borderRadius={on}
            backgroundColor={filled ? colors.headerColor : colors.frameColor}
          />
        );
      })}
    </XStack>
  );

  return (
    <MotiView
      animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 8 }}
      transition={{ type: "timing", duration: 180 }}
      pointerEvents={visible ? "auto" : "none"}>
      {big ? (
        // Large: labelled card for low-precision use.
        <YStack
          gap="$2"
          paddingHorizontal="$4"
          paddingTop="$2"
          paddingBottom="$2.5"
          borderRadius={24}
          minWidth={340}
          backgroundColor={`${colors.background}F5`}
          borderWidth={1}
          borderColor={colors.frameColor}
          style={CARD_SHADOW}>
          <Text
            fontSize={13}
            fontWeight="600"
            color={colors.headerColor}
            opacity={0.7}
            textAlign="center">
            {t("quran.autoScroll.title")}
          </Text>
          <XStack alignItems="center" justifyContent="center" gap="$2">
            {stepBtn(Minus, -1, t("a11y.quran.autoScrollSlower"), level <= 0)}
            <Text fontSize={12} fontWeight="700" color={colors.headerColor} opacity={0.75}>
              {t("quran.autoScroll.slow")}
            </Text>
            {meter()}
            <Text fontSize={12} fontWeight="700" color={colors.headerColor} opacity={0.75}>
              {t("quran.autoScroll.fast")}
            </Text>
            {stepBtn(Plus, 1, t("a11y.quran.autoScrollFaster"), level >= LEVELS.length - 1)}
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
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 56,
              borderRadius: 28,
              backgroundColor: colors.headerColor,
            }}>
            {playing ? (
              <Pause size={26} color={colors.background} fill={colors.background} />
            ) : (
              <Play size={26} color={colors.background} fill={colors.background} />
            )}
            <Text fontSize={17} fontWeight="700" color={colors.background}>
              {t(playing ? "common.pause" : "common.play")}
            </Text>
          </Pressable>
        </YStack>
      ) : (
        // Default: slim one-row pill.
        <XStack
          alignItems="center"
          gap="$2"
          paddingLeft="$2"
          paddingRight="$1"
          paddingVertical="$1"
          borderRadius={999}
          backgroundColor={`${colors.background}F5`}
          borderWidth={1}
          borderColor={colors.frameColor}
          style={CARD_SHADOW}>
          {stepBtn(Minus, -1, t("a11y.quran.autoScrollSlower"), level <= 0)}
          {meter()}
          {stepBtn(Plus, 1, t("a11y.quran.autoScrollFaster"), level >= LEVELS.length - 1)}
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ selected: playing }}
            accessibilityLabel={t(
              playing ? "a11y.quran.autoScrollPause" : "a11y.quran.autoScrollPlay"
            )}
            accessibilityHint={t("a11y.quran.autoScrollHint")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginLeft: 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.headerColor,
            }}>
            {playing ? (
              <Pause size={20} color={colors.background} fill={colors.background} />
            ) : (
              <Play size={20} color={colors.background} fill={colors.background} />
            )}
          </Pressable>
        </XStack>
      )}
    </MotiView>
  );
};

export default AutoScrollControl;
