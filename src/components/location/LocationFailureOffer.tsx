import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";
import type { ParseKeys } from "i18next";
import { CircleAlert, Globe, RefreshCw, Search } from "lucide-react-native";

import { usesHmsLocation } from "@/adapters/location";
import { ChooseCityLink } from "@/components/location/ChooseCityLink";
import {
  OpenSettingsButton,
  useOpenSettingsAction,
} from "@/components/location/OpenSettingsButton";
import { Button } from "@/components/ui/button";
import { ActionButton, ButtonPair, type PairAction } from "@/components/ui/button-pair";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ICON_TILE_TONE } from "@/components/ui/icon-tile";
import { NOTICE_LINE, NoticeCard } from "@/components/ui/notice-card";
import { Section } from "@/components/ui/section";
import { VStack } from "@/components/ui/vstack";
import { E2E_ID } from "@/constants/E2E";
import {
  ANDROID_LOCATION_SETTINGS,
  FAILURE_OFFER_VARIANT,
  LOCATION_FAILURE,
  type LocationFailure,
} from "@/constants/Location";
import { SECTION_KIND } from "@/constants/Section";
import { PlatformType } from "@/enums/app";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

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

type Common = {
  /** Why the device read failed; null when the times failed after it. */
  failure: LocationFailure | null;
  onRetry: () => void;
  onChooseCity: () => void;
  /** The city whose times failed, named when a good read came first. */
  city?: string;
};

type Props = Common &
  (
    | {
        variant?: typeof FAILURE_OFFER_VARIANT.SCREEN;
        onEnterCoordinates: () => void;
      }
    | {
        /** In the city-change card, beside the keep-saved action. */
        variant: typeof FAILURE_OFFER_VARIANT.CARD;
        keep: PairAction;
        /** Test id of the card. */
        testID?: string;
      }
  );

/** What failed, what to say about it, and which action leads. */
const useFailureView = ({ failure, city }: Pick<Common, "failure" | "city">) => {
  const { t } = useTranslation();
  const android = Platform.OS === PlatformType.ANDROID;
  const copy = copyFor(failure, android);
  const title =
    city && failure === null ? t("location.failure.times.title", { city }) : t(copy.title);
  const hint = t(copy.hint);
  // Settings only once the system can no longer ask; until the first check
  // answers, and while it can ask, Retry stands.
  const { permission } = useLocationPermission();
  const toSettings =
    failure === LOCATION_FAILURE.DENIED && permission?.granted === false && !permission.canAskAgain;
  // iOS has no link to location services; its hint names the way.
  const servicesOffOnAndroid = android && failure === LOCATION_FAILURE.SERVICES_OFF;
  useIosAnnouncement(t("a11y.join", { first: title, second: hint }));
  return { title, hint, toSettings, servicesOffOnAndroid };
};

type ViewProps = Common & ReturnType<typeof useFailureView>;

/** The glyph, the reason and the actions: the one failure card. */
const FailureCard = ({
  title,
  hint,
  testID,
  children,
}: Pick<ViewProps, "title" | "hint"> & { testID?: string; children: ReactNode }) => (
  <NoticeCard
    testID={testID}
    icon={CircleAlert}
    tone={ICON_TILE_TONE.DANGER}
    title={title}
    lines={[{ text: hint, kind: NOTICE_LINE.BODY }]}
    live>
    {children}
  </NoticeCard>
);

const ScreenOffer = ({
  onRetry,
  onChooseCity,
  onEnterCoordinates,
  title,
  hint,
  toSettings,
  servicesOffOnAndroid,
}: ViewProps & { onEnterCoordinates: () => void }) => {
  const { t } = useTranslation();
  const retry = t("common.retry");
  const openSettings = t("location.failure.servicesOff.open");
  return (
    <VStack gap="$section">
      <FailureCard title={title} hint={hint}>
        <VStack gap="$3">
          {toSettings ? (
            <OpenSettingsButton />
          ) : (
            <Button onPress={onRetry} accessibilityLabel={retry}>
              <Button.Icon as={RefreshCw} />
              <Button.Text>{retry}</Button.Text>
            </Button>
          )}
          {servicesOffOnAndroid ? (
            <Button
              action="secondary"
              variant="outline"
              onPress={openLocationSettings}
              accessibilityLabel={openSettings}
              accessibilityHint={t("a11y.location.openLocationSettingsHint")}>
              <Button.Text>{openSettings}</Button.Text>
            </Button>
          ) : null}
        </VStack>
      </FailureCard>
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

const CardOffer = ({
  onRetry,
  onChooseCity,
  keep,
  testID,
  title,
  hint,
  toSettings,
  servicesOffOnAndroid,
}: ViewProps & { keep: PairAction; testID?: string }) => {
  const { t } = useTranslation();
  const settings = useOpenSettingsAction();
  const retry: PairAction = { label: t("common.retry"), onPress: onRetry };
  const locationSettings: PairAction = {
    label: t("location.failure.servicesOff.open"),
    hint: t("a11y.location.openLocationSettingsHint"),
    onPress: openLocationSettings,
  };
  return (
    <FailureCard title={title} hint={hint} testID={testID}>
      <VStack gap="$2">
        {servicesOffOnAndroid ? (
          <>
            <ActionButton action={retry} lead />
            <ActionButton action={locationSettings} />
            <ActionButton action={keep} />
          </>
        ) : (
          <ButtonPair primary={toSettings ? settings : retry} secondary={keep} />
        )}
        <ChooseCityLink onPress={onChooseCity} />
      </VStack>
    </FailureCard>
  );
};

/** What went wrong, retry first, then the ways to set a place by hand. */
export const LocationFailureOffer = (props: Props) => {
  const view = useFailureView(props);
  const common = { ...props, ...view };
  return props.variant === FAILURE_OFFER_VARIANT.CARD ? (
    <CardOffer {...common} keep={props.keep} testID={props.testID} />
  ) : (
    <ScreenOffer {...common} onEnterCoordinates={props.onEnterCoordinates} />
  );
};
