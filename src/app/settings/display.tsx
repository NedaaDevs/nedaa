import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Pressable } from "@/components/ui/pressable";

// Stores
import { useAppStore } from "@/stores/app";
import { useDisplayStore } from "@/stores/display";

// Utils
import { formatNumberToLocale } from "@/utils/number";

const DurationPicker = ({
  value,
  onChange,
  options,
  labelKey,
}: {
  value: number;
  onChange: (value: number) => void;
  options: number[];
  labelKey: string;
}) => {
  const { t } = useTranslation();

  return (
    <HStack backgroundColor="$backgroundMuted" borderRadius="$4" padding="$1">
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            flex={1}
            paddingVertical="$2"
            borderRadius="$3"
            backgroundColor={isSelected ? "$primary" : "transparent"}
            alignItems="center"
            justifyContent="center"
            minHeight={36}>
            <Text
              size="sm"
              color={isSelected ? "$typographyContrast" : "$typography"}
              fontWeight={isSelected ? "600" : "400"}>
              {formatNumberToLocale(t(labelKey, { count: option }))}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
};

const DisplaySettings = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const {
    useWesternNumerals,
    setUseWesternNumerals,
    countdownEnabled,
    setCountdownEnabled,
    countdownMinutes,
    setCountdownMinutes,
    iqamaCountUpEnabled,
    setIqamaCountUpEnabled,
    iqamaCountUpMinutes,
    setIqamaCountUpMinutes,
  } = useDisplayStore();

  const isArabic = locale.startsWith("ar");

  return (
    <Background>
      <TopBar title="settings.display.title" backOnClick />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <VStack padding="$4" gap="$4">
          {/* Western Numerals - only show for Arabic locale */}
          {isArabic && (
            <Box
              backgroundColor="$backgroundSecondary"
              borderRadius="$6"
              padding="$4"
              flexDirection="row"
              alignItems="center">
              <HStack justifyContent="space-between" alignItems="center" width="100%">
                <VStack flexShrink={1} marginEnd="$4">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.display.westernNumerals.title")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" marginTop="$1">
                    {t("settings.display.westernNumerals.description")}
                  </Text>
                </VStack>
                <Switch value={useWesternNumerals} onValueChange={setUseWesternNumerals} />
              </HStack>
            </Box>
          )}

          {/* Prayer Countdown */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <VStack gap="$3">
              <Box flexDirection="row" alignItems="center">
                <HStack justifyContent="space-between" alignItems="center" width="100%">
                  <VStack flexShrink={1} marginEnd="$4">
                    <Text fontWeight="500" color="$typography">
                      {t("settings.display.countdown.title")}
                    </Text>
                    <Text size="sm" color="$typographySecondary" marginTop="$1">
                      {t("settings.display.countdown.description")}
                    </Text>
                  </VStack>
                  <Switch value={countdownEnabled} onValueChange={setCountdownEnabled} />
                </HStack>
              </Box>

              {countdownEnabled && (
                <DurationPicker
                  value={countdownMinutes}
                  onChange={setCountdownMinutes}
                  options={[15, 30, 45, 60]}
                  labelKey="settings.display.countdown.minutes"
                />
              )}
            </VStack>
          </Box>

          {/* Iqama Count-Up */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <VStack gap="$3">
              <Box flexDirection="row" alignItems="center">
                <HStack justifyContent="space-between" alignItems="center" width="100%">
                  <VStack flexShrink={1} marginEnd="$4">
                    <Text fontWeight="500" color="$typography">
                      {t("settings.display.iqamaCountUp.title")}
                    </Text>
                    <Text size="sm" color="$typographySecondary" marginTop="$1">
                      {t("settings.display.iqamaCountUp.description")}
                    </Text>
                  </VStack>
                  <Switch value={iqamaCountUpEnabled} onValueChange={setIqamaCountUpEnabled} />
                </HStack>
              </Box>

              {iqamaCountUpEnabled && (
                <DurationPicker
                  value={iqamaCountUpMinutes}
                  onChange={setIqamaCountUpMinutes}
                  options={[10, 15, 20, 30]}
                  labelKey="settings.display.iqamaCountUp.minutes"
                />
              )}
            </VStack>
          </Box>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default DisplaySettings;
