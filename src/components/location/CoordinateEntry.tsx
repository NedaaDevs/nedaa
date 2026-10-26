import { useEffect, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Platform } from "react-native";
import type { ParseKeys } from "i18next";
import { CircleAlert } from "lucide-react-native";

// Components
import { Button } from "@/components/ui/button";
import { CALLOUT_TONE, Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

// Constants
import { COORDINATE_ERROR, COORDINATE_PROBLEM, type CoordinateError } from "@/constants/Cities";
import { PlatformType } from "@/enums/app";

// Hooks
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";

// Services
import { CitiesDB } from "@/services/cities-db";

// Stores
import { isRunning, useLocationUpdateStore } from "@/stores/locationUpdate";

// Utils
import {
  CoordinateAxis,
  formatCityLabel,
  readCoordinate,
  toAsciiNumerals,
  type CoordinateAxisValue,
} from "@/utils/cities";

// Types
import type { NearestCity } from "@/types/cities";
import type { ManualLocation } from "@/types/location";

/** The pause in typing before the nearest city is looked up. */
export const NEAREST_LOOKUP_DEBOUNCE_MS = 200;

/** What an axis's field says about itself and what is wrong with it. */
type AxisCopy = {
  label: ParseKeys;
  range: ParseKeys;
  spoken: ParseKeys;
  errors: Record<CoordinateError, ParseKeys>;
};

const AXIS_COPY: Record<CoordinateAxisValue, AxisCopy> = {
  [CoordinateAxis.LATITUDE]: {
    label: "location.coordinates.latitude",
    range: "location.coordinates.latitudeRange",
    spoken: "a11y.location.coordinates.latitude",
    errors: {
      [COORDINATE_ERROR.NOT_A_NUMBER]: "location.coordinates.latitudeNotNumber",
      [COORDINATE_ERROR.OUT_OF_RANGE]: "location.coordinates.latitudeInvalid",
    },
  },
  [CoordinateAxis.LONGITUDE]: {
    label: "location.coordinates.longitude",
    range: "location.coordinates.longitudeRange",
    spoken: "a11y.location.coordinates.longitude",
    errors: {
      [COORDINATE_ERROR.NOT_A_NUMBER]: "location.coordinates.longitudeNotNumber",
      [COORDINATE_ERROR.OUT_OF_RANGE]: "location.coordinates.longitudeInvalid",
    },
  },
};

/** A pad with digits, a minus sign and a decimal mark on each platform. */
const coordinateKeyboard = (): ComponentProps<typeof Input>["keyboardType"] =>
  Platform.OS === PlatformType.IOS ? "numbers-and-punctuation" : "numeric";

/** Android pins the layout direction, iOS the paragraph's. */
const LTR_NUMBER = { direction: "ltr", writingDirection: "ltr" } as const;

type FieldProps = { axis: CoordinateAxisValue; text: string; onChangeText: (text: string) => void };

/** One full-width field: labels run long and a coordinate needs room. */
const CoordinateField = ({ axis, text, onChangeText }: FieldProps) => {
  const { t } = useTranslation();
  const copy = AXIS_COPY[axis];
  const reading = readCoordinate(text, axis);
  const problem =
    "problem" in reading && reading.problem !== COORDINATE_PROBLEM.INCOMPLETE
      ? reading.problem
      : null;
  const error = problem ? t(copy.errors[problem]) : null;
  useIosAnnouncement(error);

  return (
    <VStack gap="$1.5">
      {/* The span beside the name: the limit is known before typing. */}
      <HStack justifyContent="space-between" alignItems="baseline" gap="$2">
        <Text size="md" fontWeight="600" color="$fg">
          {t(copy.label)}
        </Text>
        <Text size="helper" color="$muted">
          {t(copy.range)}
        </Text>
      </HStack>
      <Input
        value={text}
        // Arabic-Indic digits and «٫» show as the Western digits they mean.
        onChangeText={(next) => onChangeText(toAsciiNumerals(next))}
        keyboardType={coordinateKeyboard()}
        autoCorrect={false}
        placeholder="0.0000"
        invalid={error !== null}
        // A leading minus has no direction; RTL would move it after the digits.
        style={LTR_NUMBER}
        accessibilityLabel={t(copy.spoken)}
        accessibilityHint={error ?? undefined}
      />
      {error ? (
        <HStack
          alignItems="flex-start"
          gap="$1.5"
          accessible
          accessibilityLabel={error}
          accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size="xs" color="$danger" />
          <Text size="helper" fontWeight="600" color="$danger" flex={1}>
            {error}
          </Text>
        </HStack>
      ) : null}
    </VStack>
  );
};

type Point = { latitude: number; longitude: number };

/** A lookup's answer for the point and attempt it ran for. */
type Lookup = Point & { attempt: number } & (
    { failed: false; nearest: NearestCity | null } | { failed: true }
  );

/** What a settled lookup says first: the city, or why there is none. */
const useLookupLine = () => {
  const { t, i18n } = useTranslation();
  return (lookup: Lookup) => {
    if (lookup.failed) return t("location.coordinates.lookupFailed");
    if (!lookup.nearest) return t("location.coordinates.noNearbyCity");
    return t("location.coordinates.nearestCity", {
      city: formatCityLabel(lookup.nearest.city, i18n.language).city,
    });
  };
};

type PreviewProps = { lookup: Lookup | null; onRetry: () => void };

/** What the point resolves to; the entry says it once it settles. */
const NearestPreview = ({ lookup, onRetry }: PreviewProps) => {
  const { t } = useTranslation();
  const line = useLookupLine();

  if (!lookup) {
    return (
      <Callout tone={CALLOUT_TONE.INFO} body={t("location.coordinates.resolving")} live={false} />
    );
  }
  if (lookup.failed) {
    return (
      <Callout
        body={line(lookup)}
        action={{ label: t("common.retry"), onPress: onRetry }}
        live={false}
      />
    );
  }
  if (!lookup.nearest) return <Callout body={line(lookup)} live={false} />;
  return (
    <Callout
      tone={CALLOUT_TONE.PLACE}
      title={line(lookup)}
      body={t("location.coordinates.nearestDetail", {
        distance: lookup.nearest.distanceKm.toFixed(0),
        timezone: lookup.nearest.city.timezone,
      })}
      live={false}
    />
  );
};

type CoordinateEntryProps = {
  /** The typed place, with the nearest city's names and time zone. */
  onSave: (place: ManualLocation) => void;
};

/** Typed coordinates; the nearest city lends the time zone, never a guess. */
const CoordinateEntry = ({ onSave }: CoordinateEntryProps) => {
  const { t } = useTranslation();
  const lookupLine = useLookupLine();
  const busy = useLocationUpdateStore((state) => isRunning(state.run));

  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  // Bumped by a retry, so a failed lookup runs again for the same point.
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  const latitudeReading = readCoordinate(latitudeText, CoordinateAxis.LATITUDE);
  const longitudeReading = readCoordinate(longitudeText, CoordinateAxis.LONGITUDE);
  const latitude = "value" in latitudeReading ? latitudeReading.value : null;
  const longitude = "value" in longitudeReading ? longitudeReading.value : null;

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    let cancelled = false;
    const point = { latitude, longitude, attempt };
    const timer = setTimeout(() => {
      CitiesDB.findNearestCity(latitude, longitude)
        .then((nearest) => {
          if (!cancelled) setLookup({ ...point, failed: false, nearest });
        })
        .catch(() => {
          if (!cancelled) setLookup({ ...point, failed: true });
        });
    }, NEAREST_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [latitude, longitude, attempt]);

  // Said on both platforms as the answer changes; a new distance alone is not.
  const settled = lookup ? lookupLine(lookup) : null;
  useEffect(() => {
    if (settled) AccessibilityInfo.announceForAccessibility(settled);
  }, [settled]);

  // The answer counts only for the point and attempt on screen now.
  const current =
    lookup?.latitude === latitude && lookup?.longitude === longitude && lookup?.attempt === attempt
      ? lookup
      : null;
  const nearest = current && !current.failed ? current.nearest : null;
  const place: ManualLocation | null =
    nearest && latitude !== null && longitude !== null
      ? {
          // Null marks a typed place, not a city picked by name.
          cityId: null,
          name: nearest.city.name,
          names: nearest.city.names,
          region: nearest.city.region,
          countryCode: nearest.city.countryCode,
          country: nearest.city.country,
          latitude,
          longitude,
          timezone: nearest.city.timezone,
        }
      : null;
  const canSave = place !== null && !busy;

  const handleSave = () => {
    if (place) onSave(place);
  };

  return (
    <VStack gap="$3">
      {/* Drawn on the bare sky, where plain muted ink falls short of AA. */}
      <Text size="sm" color="$mutedSky" paddingHorizontal="$1">
        {t("location.coordinates.description")}
      </Text>
      <Card gap="$3.5">
        <CoordinateField
          axis={CoordinateAxis.LATITUDE}
          text={latitudeText}
          onChangeText={setLatitudeText}
        />
        <CoordinateField
          axis={CoordinateAxis.LONGITUDE}
          text={longitudeText}
          onChangeText={setLongitudeText}
        />
        {latitude !== null && longitude !== null ? (
          <NearestPreview lookup={current} onRetry={() => setAttempt((count) => count + 1)} />
        ) : null}
        <Button
          onPress={handleSave}
          disabled={!canSave}
          accessibilityLabel={t("a11y.location.coordinates.save")}>
          <Button.Text>{t("location.coordinates.save")}</Button.Text>
        </Button>
      </Card>
    </VStack>
  );
};

export default CoordinateEntry;
