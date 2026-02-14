import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import { Center } from "@/components/ui/center";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import TopBar from "@/components/TopBar";

// Icons
import { Svg, Circle, Line, Text as SvgText, G } from "react-native-svg";

// Stores
import { useLocationStore } from "@/stores/location";

// Hooks
import { useCompass } from "@/hooks/useCompass";
import { useTheme } from "tamagui";
// Utils
import { calculateQiblaDirection, getTranslatedCompassDirection } from "@/utils/compass";
import { reshapeArabic } from "@/utils/reshaper";

const Compass = () => {
  const { heading, accuracy, isAvailable, isActive } = useCompass();
  const { locationDetails } = useLocationStore();
  const theme = useTheme();
  const { t } = useTranslation();

  const compassSize = 300;
  const centerX = compassSize / 2;
  const centerY = compassSize / 2;
  const radius = (compassSize - 80) / 2;
  const letterDistance = radius - 15;

  const colors = {
    primary: theme.primary.val,
    secondary: theme.typographySecondary.val,
    text: theme.typography.val,
    background: theme.backgroundSecondary.val,
    north: theme.error.val,
  };

  // Calculate Qibla direction if location is available
  const qiblaDirection = locationDetails.coords
    ? calculateQiblaDirection(locationDetails.coords.latitude, locationDetails.coords.longitude)
    : null;

  // Calculate the angle for the compass needle (convert heading to SVG rotation)
  const needleRotation = -heading; // Negative because we want compass to rotate opposite to device

  return (
    <Background>
      <TopBar title="compass.title" />
      <Center flex={1} paddingHorizontal="$6">
        <Box alignItems="center">
          <Box backgroundColor="$background" borderRadius={999} padding="$1">
            <Svg width={compassSize} height={compassSize} fill={colors.background}>
              {/* Fixed reference line at top - doesn't rotate */}
              <Line
                x1={centerX}
                y1={0}
                x2={centerX}
                y2={20}
                stroke={colors.primary}
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Rotating compass elements */}
              <G rotation={needleRotation} origin={`${centerX}, ${centerY}`}>
                {/* Outer circle */}
                <Circle
                  cx={centerX}
                  cy={centerY}
                  r={radius}
                  stroke={colors.primary}
                  strokeWidth="3"
                  fill={colors.background}
                />

                {/* Cardinal directions */}
                <G>
                  {/* North */}
                  <SvgText
                    x={centerX}
                    y={centerY - letterDistance}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize="18"
                    fontWeight="bolder"
                    fontFamily="NotoSansArabic-Regular"
                    fill={colors.north}>
                    {reshapeArabic(t("compass.directions.N"))}
                  </SvgText>

                  {/* South */}
                  <SvgText
                    x={centerX}
                    y={centerY + letterDistance}
                    fontWeight="bolder"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize="16"
                    fill={colors.secondary}>
                    {reshapeArabic(t("compass.directions.S"))}
                  </SvgText>

                  {/* East */}
                  <SvgText
                    x={centerX + letterDistance + 5}
                    y={centerY + 5}
                    fontWeight="bolder"
                    textAnchor="end"
                    alignmentBaseline="middle"
                    fontSize="16"
                    fill={colors.secondary}>
                    {reshapeArabic(t("compass.directions.E"))}
                  </SvgText>

                  {/* West */}
                  <SvgText
                    x={centerX - letterDistance - 5}
                    y={centerY + 5}
                    fontWeight="bolder"
                    alignmentBaseline="middle"
                    textAnchor="start"
                    fontSize="16"
                    fill={colors.secondary}>
                    {reshapeArabic(t("compass.directions.W"))}
                  </SvgText>
                </G>

                {/* Degree markings */}
                <G>
                  {Array.from({ length: 36 }, (_, i) => {
                    const angle = i * 10 * (Math.PI / 180);
                    const x1 = centerX + Math.sin(angle) * radius;
                    const y1 = centerY - Math.cos(angle) * radius;
                    const x2 = centerX + Math.sin(angle) * (radius + (i % 3 === 0 ? 10 : 5));
                    const y2 = centerY - Math.cos(angle) * (radius + (i % 3 === 0 ? 10 : 5));

                    return (
                      <Line
                        key={`mark-${i}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={colors.secondary}
                        strokeWidth={i % 3 === 0 ? "2" : "1"}
                      />
                    );
                  })}
                </G>

                {/* Kaaba symbol - positioned at edge of compass */}
                {qiblaDirection !== null && (
                  <G>
                    {/* Circle background */}
                    <Circle
                      cx={centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                      cy={centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                      r="12"
                      fill={colors.primary}
                      stroke={theme.typographyContrast.val}
                      strokeWidth="2"
                    />

                    {/* White arrow pointing outward */}
                    <G
                      rotation={qiblaDirection}
                      origin={`${centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}, ${centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20)}`}>
                      {/* Arrow shaft */}
                      <Line
                        x1={centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                        y1={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) + 6
                        }
                        x2={centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                        y2={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) - 6
                        }
                        stroke={theme.typographyContrast.val}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {/* Arrow head */}
                      <Line
                        x1={centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                        y1={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) - 6
                        }
                        x2={
                          centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20) - 3
                        }
                        y2={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) - 3
                        }
                        stroke={theme.typographyContrast.val}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <Line
                        x1={centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20)}
                        y1={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) - 6
                        }
                        x2={
                          centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 20) + 3
                        }
                        y2={
                          centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 20) - 3
                        }
                        stroke={theme.typographyContrast.val}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </G>
                  </G>
                )}

                {/* Compass needle - rotates with device heading */}
                <G origin={`${centerX}, ${centerY}`}>
                  {/* North pointer (red) */}
                  <Line
                    x1={centerX}
                    y1={centerY + 40}
                    x2={centerX}
                    y2={centerY - 40}
                    stroke={colors.secondary}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* South pointer (gray) */}
                  <Line
                    x1={centerX + 40}
                    y1={centerY}
                    x2={centerX - 40}
                    y2={centerY}
                    stroke={colors.secondary}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </G>
              </G>
            </Svg>
          </Box>

          {/* Compass Information Card */}
          <Box marginTop="$6" width="100%" maxWidth={384}>
            <Box padding="$4" borderRadius="$6" backgroundColor="$backgroundSecondary">
              {!isAvailable ? (
                <Text color="$error" textAlign="center" fontWeight="500">
                  {t("compass.notAvailable")}
                </Text>
              ) : !isActive ? (
                <Text color="$typographySecondary" textAlign="center">
                  {t("compass.starting")}
                </Text>
              ) : (
                <VStack gap="$3">
                  {/* Current Direction */}
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text color="$typography" fontWeight="500">
                      {t("compass.currentDirection")}
                    </Text>
                    <HStack alignItems="center" gap="$2">
                      <Text color="$typographySecondary" size="xl" bold>
                        {Math.round(heading)}°
                      </Text>
                      <Box width={32}>
                        <Text color="$typographySecondary" size="sm" textAlign="center">
                          {getTranslatedCompassDirection(heading, t)}
                        </Text>
                      </Box>
                    </HStack>
                  </HStack>

                  {/* Qibla Direction */}
                  {qiblaDirection !== null && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text color="$typography" fontWeight="500">
                        {t("compass.qiblaDirection")}
                      </Text>
                      <HStack alignItems="center" gap="$2">
                        <Text color="$success" size="xl" bold>
                          {Math.round(qiblaDirection)}°
                        </Text>
                        <Box width={32}>
                          <Text color="$typographySecondary" size="sm" textAlign="center">
                            {getTranslatedCompassDirection(qiblaDirection, t)}
                          </Text>
                        </Box>
                      </HStack>
                    </HStack>
                  )}

                  {/* Accuracy */}
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text color="$typography" fontWeight="500">
                      {t("compass.accuracy")}
                    </Text>
                    <Text color="$typographySecondary" size="md">
                      {Math.round(accuracy)}%
                    </Text>
                  </HStack>

                  {/* Calibration Note */}
                  <Box
                    marginTop="$2"
                    padding="$3"
                    borderRadius="$4"
                    backgroundColor="$backgroundMuted">
                    <Text color="$info" size="xs" textAlign="center">
                      {t("compass.calibrationNote")}
                    </Text>
                  </Box>
                </VStack>
              )}
            </Box>
          </Box>
        </Box>
      </Center>
    </Background>
  );
};

export default Compass;
