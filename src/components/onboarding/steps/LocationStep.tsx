import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, ChevronLeft } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";

import { requestLocationPermission } from "@/utils/location";

type LocationStepProps = {
  onNext: () => void;
};

const StepMode = {
  PROMPT: "prompt",
  DENIED: "denied",
  PICKER: "picker",
  COORDINATES: "coordinates",
} as const;

type StepModeValue = (typeof StepMode)[keyof typeof StepMode];

/**
 * Location during first run. Sharing the device location is the default path, but a
 * user who declines — or who simply prefers not to — picks a city instead. Declining
 * never advances silently: without a location the app would fall back to Makkah's
 * prayer times without ever saying so.
 */
const LocationStep = ({ onNext }: LocationStepProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<StepModeValue>(StepMode.PROMPT);

  const handleAllow = async () => {
    const { granted } = await requestLocationPermission();
    if (granted) {
      onNext();
      return;
    }
    setMode(StepMode.DENIED);
  };

  if (mode === StepMode.PICKER || mode === StepMode.COORDINATES) {
    const isCoordinates = mode === StepMode.COORDINATES;

    return (
      <VStack flex={1}>
        <HStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingTop="$2">
          {/* The picker is only reachable after a decline, so backing out of it returns
              there rather than to the initial prompt — re-offering the permission would
              just re-deny it silently on iOS. */}
          <Pressable
            onPress={() => setMode(isCoordinates ? StepMode.PICKER : StepMode.DENIED)}
            minWidth={44}
            minHeight={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}>
            <Icon as={ChevronLeft} size="md" color="$typography" />
          </Pressable>
          <Text size="lg" fontWeight="600" color="$typography">
            {t(isCoordinates ? "location.coordinates.title" : "location.picker.title")}
          </Text>
        </HStack>

        {isCoordinates ? (
          <CoordinateEntry onDone={onNext} />
        ) : (
          <CityPicker onDone={onNext} onEnterCoordinates={() => setMode(StepMode.COORDINATES)} />
        )}
      </VStack>
    );
  }

  const isDenied = mode === StepMode.DENIED;

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8" gap="$5">
      <Box
        width={80}
        height={80}
        borderRadius={999}
        backgroundColor="$backgroundInfo"
        alignItems="center"
        justifyContent="center">
        <Icon as={MapPin} size="xl" color="$info" />
      </Box>

      <VStack gap="$2" alignItems="center">
        <Text size="3xl" bold textAlign="center">
          {t(isDenied ? "onboarding.location.deniedTitle" : "onboarding.location.title")}
        </Text>
        <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
          {t(isDenied ? "onboarding.location.deniedBody" : "onboarding.location.description")}
        </Text>
      </VStack>

      {/* Sharing the device location is the only action offered up front; picking a city
          is the answer to a decline, not a competing choice that invites one. */}
      <VStack gap="$3" alignItems="center" width="100%">
        {isDenied ? (
          <>
            <Button
              onPress={() => setMode(StepMode.PICKER)}
              size="lg"
              paddingHorizontal="$8"
              accessibilityRole="button"
              accessibilityLabel={t("a11y.onboarding.location.chooseCity")}>
              <Button.Text fontWeight="500">{t("onboarding.location.chooseCity")}</Button.Text>
            </Button>

            <Pressable
              onPress={onNext}
              minHeight={44}
              paddingHorizontal="$4"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("a11y.onboarding.location.skip")}>
              <Text size="sm" color="$typographySecondary">
                {t("onboarding.location.skip")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Button
            onPress={handleAllow}
            size="lg"
            paddingHorizontal="$12"
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.location.allow")}>
            <Button.Text fontWeight="500">{t("onboarding.location.allow")}</Button.Text>
          </Button>
        )}
      </VStack>
    </VStack>
  );
};

export default LocationStep;
