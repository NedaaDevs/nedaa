import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import type { ParseKeys } from "i18next";
import { LocateFixed, MapPin, RefreshCw, Search } from "lucide-react-native";

import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { Button } from "@/components/ui/button";
import { CALLOUT_TONE, Callout } from "@/components/ui/callout";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SwitchGroup } from "@/components/ui/switch-group";
import { E2E_ID } from "@/constants/E2E";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SECTION_KIND } from "@/constants/Section";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import { useHaptic } from "@/hooks/useHaptic";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { useLocationStore } from "@/stores/location";
import type { UpdateRun } from "@/stores/locationUpdate";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

const MODES = Object.values(LocationMode);

/** The same words onboarding uses for the two ways to set a place. */
const MODE_LABEL: Record<LocationModeValue, ParseKeys> = {
  [LocationMode.DEVICE]: "onboarding.location.automatic",
  [LocationMode.MANUAL]: "onboarding.location.city",
};

type ModeProps = {
  mode: LocationModeValue;
  onChooseDevice: () => void;
  onChooseCity: () => void;
  /** A read or update runs; the place cannot change under it. */
  busy: boolean;
};

/** The device or a city, one radio group; choosing a city opens the list. */
const LocationModeChoice = ({ mode, onChooseDevice, onChooseCity, busy }: ModeProps) => {
  const { t } = useTranslation();
  // Only an option that is not chosen leads anywhere.
  const opensList = (option: LocationModeValue) =>
    option === LocationMode.MANUAL && mode === LocationMode.DEVICE;

  return (
    <SegmentedChoice
      options={MODES}
      value={mode}
      onChange={(next) => (next === LocationMode.MANUAL ? onChooseCity() : onChooseDevice())}
      accessibilityLabel={t("a11y.location.mode")}
      label={(option) => t(MODE_LABEL[option])}
      optionTestID={(option) => (opensList(option) ? E2E_ID.LOCATION_CHOOSE_CITY : undefined)}
      optionHint={(option) =>
        opensList(option) ? t("a11y.location.manual.chooseCityHint") : undefined
      }
      disabled={busy}
    />
  );
};

const openAppSettings = () =>
  Linking.openSettings().catch((error: unknown) =>
    log.w(
      "Root",
      `app settings failed to open: ${error instanceof Error ? error.message : String(error)}`
    )
  );

/** The way to the app's page in Settings, where location access is given. */
const OpenSettingsButton = () => {
  const { t } = useTranslation();
  const label = t("location.permission.openSettings");
  return (
    <Button
      onPress={openAppSettings}
      accessibilityLabel={label}
      accessibilityHint={t("a11y.location.openSettingsHint")}>
      <Button.Text>{label}</Button.Text>
    </Button>
  );
};

/** Until a place is found, the times are Makkah's. */
export const StandInNotice = () => {
  const { t } = useTranslation();
  return <Callout body={t("today.defaultLocation.body")} />;
};

/** A city by hand, which needs no location access. */
const ChooseCityRow = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  return (
    <ListRow
      variant={LIST_ROW_VARIANT.GROUPED}
      icon={Search}
      tile
      title={t("onboarding.location.chooseCity")}
      status={t("onboarding.location.cityNote")}
      wrapStatus
      hint={t("a11y.location.manual.chooseCityHint")}
      testID={E2E_ID.LOCATION_CHOOSE_CITY}
      onPress={onPress}
    />
  );
};

type DeviceProps = {
  onChooseCity: () => void;
  onRefresh: () => void;
  /** The last update, drawn when a later step stopped it. */
  run: UpdateRun | null;
  /** A read or update runs; the place cannot change under it. */
  busy: boolean;
  onRetry: () => void;
  /** When the device last found the place, if it ever did. */
  lastFound: string | undefined;
  /** The times are a verified place's, not the stand-in Makkah's. */
  verified: boolean;
  /** The place came from the device's cached fix. */
  lastKnown: boolean;
};

export const DeviceBody = ({
  onChooseCity,
  onRefresh,
  run,
  busy,
  onRetry,
  lastFound,
  verified,
  lastKnown,
}: DeviceProps) => {
  const { t } = useTranslation();
  return (
    <>
      <LocationModeChoice
        mode={LocationMode.DEVICE}
        onChooseDevice={onRefresh}
        onChooseCity={onChooseCity}
        busy={busy}
      />
      {!verified ? (
        <StandInNotice />
      ) : lastKnown ? (
        <Callout tone={CALLOUT_TONE.INFO} body={t("location.lastKnownNotice")} />
      ) : null}
      <ListGroup>
        <ListRow
          variant={LIST_ROW_VARIANT.GROUPED}
          icon={RefreshCw}
          tile
          title={t("location.device.refresh")}
          status={lastFound}
          hint={t("a11y.location.refreshHint")}
          disabled={busy}
          onPress={onRefresh}
        />
      </ListGroup>
      <LocationUpdateProgress run={run} onRetry={onRetry} />
    </>
  );
};

type ManualProps = {
  onChooseDevice: () => void;
  onChooseCity: () => void;
  /** The last update, drawn when a later step stopped it. */
  run: UpdateRun | null;
  /** A read or update runs; the place cannot change under it. */
  busy: boolean;
  onRetry: () => void;
  /** The system refused access when the device was chosen. */
  refused: boolean;
};

export const ManualBody = ({
  onChooseDevice,
  onChooseCity,
  run,
  busy,
  onRetry,
  refused,
}: ManualProps) => {
  const { t } = useTranslation();
  const refusedNotice = t("location.manual.deviceRefused");
  // The notice answers a tap with no system prompt; VoiceOver hears it said.
  useIosAnnouncement(refused ? refusedNotice : null);
  return (
    <>
      <LocationModeChoice
        mode={LocationMode.MANUAL}
        onChooseDevice={onChooseDevice}
        onChooseCity={onChooseCity}
        busy={busy}
      />
      {refused ? (
        <>
          <Callout tone={CALLOUT_TONE.INFO} body={refusedNotice} />
          <OpenSettingsButton />
        </>
      ) : null}
      <Callout tone={CALLOUT_TONE.INFO} body={t("location.manual.notice")} />
      <ListGroup>
        <ListRow
          variant={LIST_ROW_VARIANT.GROUPED}
          icon={Search}
          tile
          title={t("location.manual.change")}
          hint={t("a11y.location.manual.chooseCityHint")}
          testID={E2E_ID.LOCATION_CHOOSE_CITY}
          disabled={busy}
          onPress={onChooseCity}
        />
      </ListGroup>
      <LocationUpdateProgress run={run} onRetry={onRetry} />
    </>
  );
};

type AskProps = { onChooseDevice: () => void; onChooseCity: () => void };

/** No access yet: the system asks only once the device is chosen. */
export const PermissionBody = ({ onChooseDevice, onChooseCity }: AskProps) => {
  const { t } = useTranslation();
  return (
    <ListGroup>
      <ListRow
        variant={LIST_ROW_VARIANT.GROUPED}
        icon={LocateFixed}
        tile
        title={t("onboarding.location.automatic")}
        status={t("onboarding.location.automaticNote")}
        wrapStatus
        onPress={onChooseDevice}
      />
      <ChooseCityRow onPress={onChooseCity} />
    </ListGroup>
  );
};

type DeniedProps = {
  onChooseCity: () => void;
  /** A saved place stands; without one the times are Makkah's. */
  verified: boolean;
};

/** Access refused: only Settings gives it back; a city needs none. */
export const DeniedBody = ({ onChooseCity, verified }: DeniedProps) => {
  const { t } = useTranslation();
  return (
    <>
      {verified ? (
        <Callout tone={CALLOUT_TONE.INFO} body={t("location.denied.notice")} />
      ) : (
        <StandInNotice />
      )}
      <OpenSettingsButton />
      <ListGroup>
        <ChooseCityRow onPress={onChooseCity} />
      </ListGroup>
    </>
  );
};

/** The launch check that offers an update when the device is in a new city. */
export const AutoUpdateSection = () => {
  const { t } = useTranslation();
  const lightHaptic = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const on = useLocationStore((state) => state.autoUpdateLocation);
  const setOn = useLocationStore((state) => state.setAutoUpdateLocation);

  return (
    <Section title={t("location.settings.travelSection")} kind={SECTION_KIND.LABEL}>
      <ListGroup>
        <SwitchGroup
          variant={LIST_ROW_VARIANT.GROUPED}
          icon={MapPin}
          label={t("location.settings.keepLocationUpdated.title")}
          summary={t("location.settings.keepLocationUpdated.summary")}
          value={on}
          onValueChange={(value) => {
            void lightHaptic();
            setOn(value);
          }}
        />
      </ListGroup>
    </Section>
  );
};
