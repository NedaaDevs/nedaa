import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import LocationUpdateProgress from "@/components/LocationUpdateProgress";

// Services
import { CitiesDB } from "@/services/cities-db";

// Hooks
import { useLocationUpdate } from "@/hooks/useLocationUpdate";

// Utils
import { parseCoordinate, formatCityLabel, CoordinateAxis } from "@/utils/cities";

// Types
import type { NearestCity } from "@/types/cities";
import type { ManualLocation } from "@/types/location";

type CoordinateEntryProps = {
  onDone: () => void;
};

type ResolvedNearest = {
  latitude: number;
  longitude: number;
  nearest: NearestCity | null;
};

/**
 * Typed coordinates for anywhere the city list does not reach. The coordinates are the
 * user's own; the nearest city supplies only the timezone and a readable label, and
 * without one the entry cannot be saved rather than having a timezone guessed for it.
 */
const CoordinateEntry = ({ onDone }: CoordinateEntryProps) => {
  const { t, i18n } = useTranslation();
  const { updateState, applyManualLocation, retry } = useLocationUpdate();

  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  // The coordinates a lookup answered for, so the result and the in-flight state can
  // both be derived rather than tracked separately.
  const [resolved, setResolved] = useState<ResolvedNearest | null>(null);

  const latitude = parseCoordinate(latitudeText, CoordinateAxis.LATITUDE);
  const longitude = parseCoordinate(longitudeText, CoordinateAxis.LONGITUDE);
  const isValid = latitude !== null && longitude !== null;
  const isIncomplete = latitudeText.trim() === "" || longitudeText.trim() === "";

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    let cancelled = false;
    CitiesDB.findNearestCity(latitude, longitude)
      .then((nearest) => {
        if (!cancelled) setResolved({ latitude, longitude, nearest });
      })
      .catch(() => {
        if (!cancelled) setResolved({ latitude, longitude, nearest: null });
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const isCurrent = isValid && resolved?.latitude === latitude && resolved?.longitude === longitude;
  const nearest = isCurrent ? resolved.nearest : null;
  const isResolving = isValid && !isCurrent;

  const canSave = isValid && nearest !== null && !updateState.isUpdating;

  const handleSave = async () => {
    if (latitude === null || longitude === null || !nearest) return;

    const manual: ManualLocation = {
      // Null marks a typed location, distinguishing it from a city picked by name.
      cityId: null,
      name: nearest.city.name,
      names: nearest.city.names,
      region: nearest.city.region,
      countryCode: nearest.city.countryCode,
      country: nearest.city.country,
      latitude,
      longitude,
      timezone: nearest.city.timezone,
    };

    const applied = await applyManualLocation(manual);
    if (applied) onDone();
  };

  return (
    <VStack gap="$3" padding="$4">
      <HStack gap="$3">
        <VStack flex={1} gap="$1">
          <Text size="sm" color="$typographySecondary">
            {t("location.coordinates.latitude")}
          </Text>
          <Card variant="grouped">
            <Input
              value={latitudeText}
              onChangeText={setLatitudeText}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              borderWidth={0}
              backgroundColor="transparent"
              accessibilityLabel={t("a11y.location.coordinates.latitude")}
            />
          </Card>
        </VStack>

        <VStack flex={1} gap="$1">
          <Text size="sm" color="$typographySecondary">
            {t("location.coordinates.longitude")}
          </Text>
          <Card variant="grouped">
            <Input
              value={longitudeText}
              onChangeText={setLongitudeText}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              borderWidth={0}
              backgroundColor="transparent"
              accessibilityLabel={t("a11y.location.coordinates.longitude")}
            />
          </Card>
        </VStack>
      </HStack>

      {!isIncomplete && !isValid && (
        <Text size="sm" color="$error">
          {t("location.coordinates.invalid")}
        </Text>
      )}

      {isValid && (
        <Card variant="grouped">
          <Box padding="$4">
            {isResolving ? (
              <HStack alignItems="center" gap="$3">
                <Spinner size="small" />
                <Text size="sm" color="$typographySecondary">
                  {t("location.coordinates.resolving")}
                </Text>
              </HStack>
            ) : (
              <Text size="sm" color={nearest ? "$typography" : "$warning"}>
                {nearest
                  ? t("location.coordinates.resolved", {
                      city: formatCityLabel(nearest.city, i18n.language).city,
                      distance: nearest.distanceKm.toFixed(0),
                      timezone: nearest.city.timezone,
                    })
                  : t("location.coordinates.noNearbyCity")}
              </Text>
            )}
          </Box>
        </Card>
      )}

      <LocationUpdateProgress state={updateState} onRetry={retry} />

      <Button
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.location.coordinates.save")}
        accessibilityState={{ disabled: !canSave }}>
        <Button.Text>{t("location.coordinates.save")}</Button.Text>
      </Button>
    </VStack>
  );
};

export default CoordinateEntry;
