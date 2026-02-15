import { FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Image, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "tamagui";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Check, Play, Pause, Download, Loader } from "lucide-react-native";

import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { formatFileSize } from "@/utils/customSoundManager";

import type { ReciterCatalogEntry } from "@/types/athkar-audio";

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

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDownloading) {
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
  }, [isDownloading, spinAnim]);

  return (
    <Pressable onPress={() => onSelect(reciter.id)}>
      <Box
        padding="$3"
        borderRadius="$6"
        backgroundColor={selected ? "$primary" : "$backgroundSecondary"}
        borderWidth={selected ? 2 : 1}
        borderColor={selected ? "$primary" : "$outline"}>
        <HStack alignItems="center" gap="$3">
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
              {formatFileSize(reciter.totalSize)}
              {downloaded === true ? ` · ${t("athkar.audio.downloaded")}` : ""}
            </Text>
          </VStack>

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
                    rotation={-90}
                    origin={`${PLAY_BTN / 2}, ${PLAY_BTN / 2}`}
                  />
                </Svg>
              )}
              <Pressable
                onPress={(e: any) => {
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
                justifyContent="center">
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
