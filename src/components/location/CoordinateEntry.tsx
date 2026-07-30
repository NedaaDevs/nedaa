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

type CoordinateFieldProps = {
  label: string;
  /** The permitted span, shown beside the label so the limit is known before typing. */
  range: string;
  value: string;
  onChangeText: (value: string) => void;
  isInvalid: boolean;
  errorText: string;
  accessibilityLabel: string;
};

/**
 * One full-width coordinate field. Full width rather than a half-width pair because the
 * localized labels are long and a coordinate needs room for seven or eight characters.
 */
const CoordinateField = ({
  label,
  range,
  value,
  onChangeText,
  isInvalid,
  errorText,
  accessibilityLabel,
}: CoordinateFieldProps) => (
  <VStack gap="$2">
    <HStack justifyContent="space-between" alignItems="center">
      <Text size="sm" fontWeight="600" color="$typography">
        {label}
      </Text>
      <Text size="xs" color="$typographySecondary">
        {range}
      </Text>
    </HStack>

    <Card variant="grouped" borderWidth={isInvalid ? 1 : 0} borderColor="$borderError">
      <Input
        value={value}
        onChangeText={onChangeText}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        placeholder="0.0000"
        borderWidth={0}
        backgroundColor="transparent"
        height={52}
        fontSize={20}
        paddingHorizontal="$4"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: false }}
      />
    </Card>

    {isInvalid && (
      <Text size="xs" color="$error">
        {errorText}
      </Text>
    )}
  </VStack>
);

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
    <VStack gap="$4" padding="$4">
      <Text size="sm" color="$typographySecondary">
        {t("location.coordinates.description")}
      </Text>

      <VStack gap="$4">
        <CoordinateField
          label={t("location.coordinates.latitude")}
          range={t("location.coordinates.latitudeRange")}
          value={latitudeText}
          onChangeText={setLatitudeText}
          isInvalid={latitudeText.trim() !== "" && latitude === null}
          errorText={t("location.coordinates.latitudeInvalid")}
          accessibilityLabel={t("a11y.location.coordinates.latitude")}
        />

        <CoordinateField
          label={t("location.coordinates.longitude")}
          range={t("location.coordinates.longitudeRange")}
          value={longitudeText}
          onChangeText={setLongitudeText}
          isInvalid={longitudeText.trim() !== "" && longitude === null}
          errorText={t("location.coordinates.longitudeInvalid")}
          accessibilityLabel={t("a11y.location.coordinates.longitude")}
        />
      </VStack>

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
