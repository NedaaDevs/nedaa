import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";
import type { ParseKeys } from "i18next";
import { CircleAlert, Globe, RefreshCw, Search } from "lucide-react-native";

import { usesHmsLocation } from "@/adapters/location";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { E2E_ID } from "@/constants/E2E";
import {
  ANDROID_LOCATION_SETTINGS,
  LOCATION_FAILURE,
  type LocationFailure,
} from "@/constants/Location";
import { SECTION_KIND } from "@/constants/Section";
import { PlatformType } from "@/enums/app";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

/** Test ids for the offer's parts. */
export const LOCATION_FAILURE_PART = { CARD: "location-failure-card" } as const;

type Copy = { title: ParseKeys; hint: ParseKeys };

const NOT_FOUND: Copy = {
  title: "location.failure.notFound.title",
  hint: "location.failure.notFound.hint",
};

/** What failed and what to do; null is the times failing after a good read. */
const copyFor = (failure: LocationFailure | null, android: boolean): Copy => {
  switch (failure) {
    case null:
      return { title: "today.failed.title", hint: "today.failed.body" };
    case LOCATION_FAILURE.DENIED:
      return { title: "location.failure.denied.title", hint: "location.failure.denied.hint" };
    case LOCATION_FAILURE.SERVICES_OFF:
      return {
        title: "location.failure.servicesOff.title",
        hint: android
          ? "location.failure.servicesOff.hintAndroid"
          : "location.failure.servicesOff.hintIos",
      };
    case LOCATION_FAILURE.TIMEOUT:
      return NOT_FOUND;
    case LOCATION_FAILURE.UNAVAILABLE:
      // Location Kit fails where HMS Core is missing or out of date.
      return usesHmsLocation()
        ? { title: "location.failure.hms.title", hint: "location.failure.hms.hint" }
        : NOT_FOUND;
    default: {
      const unhandled: never = failure;
      return unhandled;
    }
  }
};

const openLocationSettings = () =>
  Linking.sendIntent(ANDROID_LOCATION_SETTINGS).catch((error: unknown) =>
    log.w("Failure", `location settings failed to open: ${errorText(error)}`)
  );

type Props = {
  /** Why the device read failed; null when the times failed after it. */
  failure: LocationFailure | null;
  onRetry: () => void;
  onChooseCity: () => void;
  onEnterCoordinates: () => void;
  /** Drawn inside a sheet: on its panel tone, not a lifted card. */
  inSheet?: boolean;
};

/** What went wrong, retry first, then the ways to set a place by hand. */
export const LocationFailureOffer = ({
  failure,
  onRetry,
  onChooseCity,
  onEnterCoordinates,
  inSheet = false,
}: Props) => {
  const { t } = useTranslation();
  const android = Platform.OS === PlatformType.ANDROID;
  const copy = copyFor(failure, android);
  const title = t(copy.title);
  const hint = t(copy.hint);
  const message = t("a11y.sentences", { first: title, second: hint });
  const retry = t("common.retry");
  const openSettings = t("location.failure.servicesOff.open");
  useIosAnnouncement(message);

  return (
    <VStack gap="$section">
      <Card testID={LOCATION_FAILURE_PART.CARD} variant={inSheet ? "panel" : "plain"} gap="$3">
        {/* One announced message; the actions stay reachable beside it. */}
        <HStack
          alignItems="flex-start"
          gap="$2.5"
          accessible
          accessibilityLabel={message}
          accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size="md" color="$danger" />
          <VStack flex={1} gap="$0.5">
            <Text size="md" fontWeight="600" color="$fg">
              {title}
            </Text>
            <Text size="sm" color="$muted">
              {hint}
            </Text>
          </VStack>
        </HStack>
        <Button onPress={onRetry} accessibilityLabel={retry}>
          <Button.Icon as={RefreshCw} />
          <Button.Text>{retry}</Button.Text>
        </Button>
        {/* iOS has no link to location services; its hint names the way. */}
        {android && failure === LOCATION_FAILURE.SERVICES_OFF ? (
          <Button
            action="secondary"
            variant="outline"
            onPress={openLocationSettings}
            accessibilityLabel={openSettings}
            accessibilityHint={t("a11y.location.openLocationSettingsHint")}>
            <Button.Text>{openSettings}</Button.Text>
          </Button>
        ) : null}
      </Card>
      <Section title={t("location.failure.otherWays")} kind={SECTION_KIND.LABEL}>
        <ListGroup>
          <ListRow
            variant={LIST_ROW_VARIANT.GROUPED}
            icon={Search}
            tile
            title={t("onboarding.location.chooseCity")}
            status={t("location.failure.chooseCityNote")}
            wrapStatus
            hint={t("a11y.location.manual.chooseCityHint")}
            testID={E2E_ID.LOCATION_CHOOSE_CITY}
            onPress={onChooseCity}
          />
          <ListRow
            variant={LIST_ROW_VARIANT.GROUPED}
            icon={Globe}
            tile
            title={t("location.picker.enterCoordinates")}
            status={t("location.failure.coordinatesNote")}
            wrapStatus
            hint={t("a11y.location.picker.enterCoordinatesHint")}
            onPress={onEnterCoordinates}
          />
        </ListGroup>
      </Section>
    </VStack>
  );
};
