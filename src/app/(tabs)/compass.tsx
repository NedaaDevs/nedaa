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
import { useAppStore } from "@/stores/app";

// Hooks
import { useCompass } from "@/hooks/useCompass";
import { useColorScheme } from "nativewind";
// Utils
import { calculateQiblaDirection, getCompassDirection } from "@/utils/compass";

const Compass = () => {
  const { heading, accuracy, isAvailable, isActive } = useCompass();
  const { locationDetails } = useLocationStore();
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();

  const compassSize = 300;
  const centerX = compassSize / 2;
  const centerY = compassSize / 2;
  const radius = (compassSize - 80) / 2;
  const letterDistance = radius - 15;

  // Theme-aware colors
  const colors = {
    primary: colorScheme === "dark" ? "#5b7da7" : "#315287",
    secondary: colorScheme === "dark" ? "#94a3b8" : "#64748b",
    text: colorScheme === "dark" ? "#f1f5f9" : "#1e293b",
    background: colorScheme === "dark" ? "#374151" : "#e4e5e6d6",
    north: colorScheme === "dark" ? "#ef4444" : "#dc2626",
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
      <Center className="flex-1 px-6">
        <Box className="items-center">
          <Box className="bg-background rounded-full p-1 shadow-lg">
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
                    fill={colors.north}>
                    N
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
                    S
                  </SvgText>

                  {/* East */}
                  <SvgText
                    x={centerX + letterDistance}
                    y={centerY + 5}
                    fontWeight="bolder"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize="16"
                    fill={colors.secondary}>
                    E
                  </SvgText>

                  {/* West */}
                  <SvgText
                    x={centerX - letterDistance}
                    y={centerY + 5}
                    fontWeight="bolder"
                    alignmentBaseline="middle"
                    textAnchor="middle"
                    fontSize="16"
                    fill={colors.secondary}>
                    W
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
                      stroke="#ffffff"
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
                        stroke="#ffffff"
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
                        stroke="#ffffff"
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
                        stroke="#ffffff"
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
          <Box className="mt-6 w-full max-w-sm">
            <Box className="p-4 rounded-xl bg-background-secondary dark:bg-background-tertiary">
              {!isAvailable ? (
                <Text className="text-error text-center font-medium">
                  {t("compass.notAvailable")}
                </Text>
              ) : !isActive ? (
                <Text className="text-typography-secondary text-center">
                  {t("compass.starting")}
                </Text>
              ) : (
                <VStack space="md">
                  {/* Current Direction */}
                  <HStack className="justify-between items-center">
                    <Text className="text-typography font-medium">
                      {t("compass.currentDirection")}
                    </Text>
                    <HStack className="items-center" space="sm">
                      <Text className="text-typography-secondary text-xl font-bold">
                        {Math.round(heading)}°
                      </Text>
                      <Box className="w-8">
                        <Text className="text-typography-secondary text-sm text-center">
                          {getCompassDirection(heading)}
                        </Text>
                      </Box>
                    </HStack>
                  </HStack>

                  {/* Qibla Direction */}
                  {qiblaDirection !== null && (
                    <HStack className="justify-between items-center">
                      <Text className="text-typography font-medium">
                        {t("compass.qiblaDirection")}
                      </Text>
                      <HStack className="items-center" space="sm">
                        <Text className="text-green-600 dark:text-green-400 text-xl font-bold">
                          {Math.round(qiblaDirection)}°
                        </Text>
                        <Box className="w-8">
                          <Text className="text-typography-secondary text-sm text-center">
                            {getCompassDirection(qiblaDirection)}
                          </Text>
                        </Box>
                      </HStack>
                    </HStack>
                  )}

                  {/* Accuracy */}
                  <HStack className="justify-between items-center">
                    <Text className="text-typography font-medium">{t("compass.accuracy")}</Text>
                    <Text className="text-typography-secondary text-base">
                      {Math.round(accuracy)}%
                    </Text>
                  </HStack>

                  {/* Calibration Note */}
                  <Box className="mt-2 p-3 rounded-lg bg-background-tertiary dark:bg-background">
                    <Text className="text-typography-info text-xs text-center">
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
