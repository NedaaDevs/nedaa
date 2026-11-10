import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Image,
  View,
  useAnimatedValue,
} from "react-native";
import Svg, { Circle, type CircleProps } from "react-native-svg";
import { useTheme } from "@/components/ui/theme-color";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Check, Play, Pause, Download, Loader } from "lucide-react-native";

import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { formatFileSize } from "@/utils/customSoundManager";
import { formatFileSizeLocale } from "@/utils/number";

import type { ReciterCatalogEntry } from "@/types/athkar-audio";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  reciter: ReciterCatalogEntry;
  selected: boolean;
  downloaded?: boolean;
  isDownloading?: boolean;
  onSelect: (id: string) => void;
  onPlaySample?: (url: string) => void;
  onStopSample?: () => void;
  isSamplePlaying?: boolean;
  sampleProgress?: number;
};

const PLAY_BTN = 44;
const RING_RADIUS = 19;
const RING_STROKE = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
// rotate(-90) about the button's centre, so the ring fills from 12 o'clock.
const RING_FROM_TOP: CircleProps["transform"] = [0, -1, 1, 0, 0, PLAY_BTN];

const ReciterCard: FC<Props> = ({
  reciter,
  selected,
  downloaded,
  isDownloading,
  onSelect,
  onPlaySample,
  onStopSample,
  isSamplePlaying,
  sampleProgress,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const name = reciterRegistry.getLocalizedName(reciter.name, i18n.language);
  const size = formatFileSize(reciter.totalSize);
  const downloadedNote = downloaded === true ? t("athkar.audio.downloaded") : null;
  // A label hides the text inside the radio, and the badge has no words.
  // The radio state says the choice; a progress bar says the download.
  const label = [name, formatFileSizeLocale(reciter.totalSize, t), downloadedNote]
    .filter((part) => part !== null)
    .reduce((first, second) => t("a11y.join", { first, second }));

  const reduceMotion = useReducedMotion();

  const spinAnim = useAnimatedValue(0);

  useEffect(() => {
    if (isDownloading && !reduceMotion) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
    spinAnim.setValue(0);
  }, [isDownloading, reduceMotion, spinAnim]);

  return (
    // The card holds the sample button, so the radio is the name area inside it.
    <Pressable accessible={false} onPress={() => onSelect(reciter.id)}>
      <Box
        padding="$3"
        borderRadius="$6"
        backgroundColor={selected ? "$primary" : "$backgroundSecondary"}
        borderWidth={selected ? 2 : 1}
        borderColor={selected ? "$primary" : "$outline"}>
        <HStack alignItems="center" gap="$3">
          <Pressable
            flex={1}
            flexDirection="row"
            alignItems="center"
            gap="$3"
            onPress={() => onSelect(reciter.id)}
            accessible
            role="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}>
            {reciter.avatar ? (
              <Image
                source={{ uri: reciter.avatar }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <Box
                width={48}
                height={48}
                borderRadius={24}
                backgroundColor={selected ? "$backgroundSecondary" : "$backgroundMuted"}
                alignItems="center"
                justifyContent="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  {name.charAt(0)}
                </Text>
              </Box>
            )}

            <VStack flex={1}>
              <Text fontWeight="600" color={selected ? "$typographyContrast" : "$typography"}>
                {name}
              </Text>
              <Text size="sm" color={selected ? "$typographyContrast" : "$typographySecondary"}>
                {size}
                {downloadedNote === null ? "" : ` · ${downloadedNote}`}
              </Text>
            </VStack>
          </Pressable>

          {onPlaySample && reciter.sampleUrl && (
            <View style={{ width: PLAY_BTN, height: PLAY_BTN }}>
              {isSamplePlaying && sampleProgress != null && (
                <Svg width={PLAY_BTN} height={PLAY_BTN} style={{ position: "absolute" }}>
                  <Circle
                    cx={PLAY_BTN / 2}
                    cy={PLAY_BTN / 2}
                    r={RING_RADIUS}
                    stroke={theme.primary.val}
                    strokeWidth={RING_STROKE}
                    fill="transparent"
                    strokeDasharray={`${CIRCUMFERENCE}`}
                    strokeDashoffset={`${CIRCUMFERENCE * (1 - sampleProgress)}`}
                    strokeLinecap="round"
                    transform={RING_FROM_TOP}
                  />
                </Svg>
              )}
              <Pressable
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  if (isSamplePlaying) {
                    onStopSample?.();
                  } else {
                    onPlaySample(reciter.sampleUrl);
                  }
                }}
                width={PLAY_BTN}
                height={PLAY_BTN}
                borderRadius={PLAY_BTN / 2}
                backgroundColor={selected ? "$backgroundSecondary" : "$backgroundMuted"}
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("a11y.join", {
                  first: isSamplePlaying
                    ? t("a11y.athkar.stopSample")
                    : t("a11y.athkar.playSample"),
                  second: name,
                })}
                accessibilityRole="button">
                <Icon as={isSamplePlaying ? Pause : Play} size="sm" color="$typography" />
              </Pressable>
            </View>
          )}

          {selected && (
            <Box
              width={28}
              height={28}
              borderRadius={14}
              backgroundColor={
                isDownloading || downloaded === false ? "$backgroundMuted" : "$typographyContrast"
              }
              alignItems="center"
              justifyContent="center">
              {isDownloading ? (
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: spinAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  }}>
                  <Icon as={Loader} size="sm" color="$typographySecondary" />
                </Animated.View>
              ) : (
                <Icon
                  as={downloaded === false ? Download : Check}
                  size="sm"
                  color={downloaded === false ? "$typographySecondary" : "$primary"}
                />
              )}
            </Box>
          )}
        </HStack>
      </Box>
    </Pressable>
  );
};

export default ReciterCard;
