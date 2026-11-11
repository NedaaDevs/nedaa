import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, type ViewInstance } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  Check,
  CircleAlert,
  Clock,
  Hourglass,
  MapPin,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react-native";

import { ChooseCityLink } from "@/components/location/ChooseCityLink";
import { LocationFailureOffer } from "@/components/location/LocationFailureOffer";
import { offerShapeOf, offerViewOf, ownRunOf } from "@/components/location/cityOfferView";
import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { ActionButton, ButtonPair, type PairAction } from "@/components/ui/button-pair";
import { ICON_TILE_TONE, type IconTileTone } from "@/components/ui/icon-tile";
import { NOTICE_LINE, NoticeCard, noticeLabel, type NoticeLine } from "@/components/ui/notice-card";
import { TEXT_ACTION_GAP, TextAction } from "@/components/ui/text-action";
import { VStack } from "@/components/ui/vstack";
import {
  CITY_OFFER_PART,
  CITY_OFFER_STAGE,
  NO_PLACE,
  OFFER_SHAPE,
  OFFER_VIEW,
  type OfferShape,
} from "@/constants/CityOffer";
import {
  CITY_PICKER_VIEW,
  FAILURE_OFFER_VARIANT,
  LOCATION_UPDATE_SURFACE,
  RUN_END,
  STEP_OUTCOME,
  UPDATE_STEP,
  locationPickerRoute,
} from "@/constants/Location";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { usePlace } from "@/hooks/usePlace";
import { useViewFocus } from "@/hooks/useViewFocus";
import { useZoneLine } from "@/hooks/useZoneLine";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { isRunning } from "@/stores/locationUpdate";
import type { CityCandidate, CityOffer, ZonePlace } from "@/types/cityCheck";
import { focusOn } from "@/utils/accessibilityFocus";
import { resolveLocalizedName } from "@/utils/cities";

/** The saved place as the offer found it; an update moves it under the card. */
type Saved = { candidate: CityCandidate; city: string | null; zone: string | null };

/** The device city's name in the app's language; null when no row named it. */
const nameOf = (candidate: CityCandidate, language: string): string | null =>
  candidate.name
    ? resolveLocalizedName(candidate.name.name, candidate.name.names ?? undefined, language)
    : null;

/** What the card says and shows for one view. */
type Face = {
  icon: LucideIcon;
  tone: IconTileTone;
  eyebrow?: string;
  title: string;
  lines: NoticeLine[];
};

const line = (text: string, kind: NoticeLine["kind"], icon?: LucideIcon): NoticeLine => ({
  text,
  kind,
  icon,
});

/** The card, drawn from one offer. */
const OfferCard = ({ offer }: { offer: CityOffer }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const focused = useIsFocused();
  const offline = useIsOffline();
  const { run: liveRun, applyCandidate, dismissFailure } = useLocationUpdate();
  const place = usePlace();
  const savedZoneNow = useLocationStore(
    (state) => state.previousPlace?.timezone ?? state.locationDetails.timezone
  );
  const newZone = useLocationStore((state) => state.locationDetails.timezone);
  const storedFailure = useLocationStore((state) => state.locationDetails.error);
  const reading = useLocationStore((state) => state.isGettingLocation);
  const placeSettled = useLocationStore((state) => state.previousPlace === null);
  const { candidate } = offer;

  // Taken when the offer arrives, and again only for another offer.
  const firstSaved = (): Saved => ({
    candidate,
    city: offer.from ? offer.from.city : (place.city ?? null),
    zone: offer.from ? offer.from.zone : savedZoneNow,
  });
  const [saved, setSaved] = useState<Saved>(firstSaved);
  if (saved.candidate !== candidate) setSaved(firstSaved());

  const here = nameOf(candidate, i18n.language);
  const shape = offerShapeOf({ here, saved: saved.city });
  const ownRun = ownRunOf(liveRun, candidate);
  // Off screen the card draws no run, as the Location screen does.
  const run = focused ? ownRun : null;
  const view = offerViewOf({
    stage: offer.stage.kind,
    run,
    readFailed: storedFailure !== null,
  });
  const busy = (isRunning(liveRun) && ownRun === null) || reading;
  const distance = Math.round(candidate.distanceKm);

  // The place after an update, named against the one the times came from.
  const from: ZonePlace = offer.from ?? { city: saved.city, zone: saved.zone };
  const landedShape = offerShapeOf({ here: place.city ?? null, saved: from.city });
  const landedTitle = {
    [OFFER_SHAPE.NAMED]: t("location.cityOffer.updated.title", { city: place.city }),
    [OFFER_SHAPE.SAME_NAME]: t("location.cityOffer.updated.titleHere", { saved: from.city }),
    [OFFER_SHAPE.UNNAMED]: t("location.cityOffer.updated.titleUnnamed"),
  }[landedShape];

  // The updated card compares the new place with the old; the offer and the
  // kept card compare the device city with the saved one.
  const zonePair = ((): [ZonePlace, ZonePlace] => {
    if (view === OFFER_VIEW.UPDATED) return [{ city: place.city ?? null, zone: newZone }, from];
    if (view === OFFER_VIEW.KEPT || (view === OFFER_VIEW.OFFER && shape === OFFER_SHAPE.NAMED)) {
      return [
        { city: here, zone: candidate.zone },
        { city: saved.city, zone: saved.zone },
      ];
    }
    return [NO_PLACE, NO_PLACE];
  })();
  const zoneLine = useZoneLine(...zonePair);
  const fact = zoneLine ? [line(zoneLine, NOTICE_LINE.FACT, Clock)] : [];

  // --- Titles and lines -----------------------------------------------------
  const savedBody = saved.city
    ? t("location.cityOffer.body", { saved: saved.city })
    : t("location.cityOffer.bodyNoSavedName");
  const offerTitle: Record<OfferShape, string> = {
    [OFFER_SHAPE.NAMED]: t("location.cityOffer.title", { city: here }),
    [OFFER_SHAPE.SAME_NAME]: t("location.cityOffer.sameName.title"),
    [OFFER_SHAPE.UNNAMED]: saved.city
      ? t("location.cityOffer.unnamed.title", { distance, saved: saved.city })
      : t("location.cityOffer.unnamed.titleNoSavedName", { distance }),
  };
  const offerBody =
    shape === OFFER_SHAPE.SAME_NAME
      ? t("location.cityOffer.sameName.body", { distance, saved: saved.city })
      : savedBody;
  const offlineText =
    shape === OFFER_SHAPE.NAMED
      ? t("location.cityOffer.offline", { city: here })
      : t("location.cityOffer.offlineHere");
  const reasons = [
    ...(offline ? [line(offlineText, NOTICE_LINE.REASON, WifiOff)] : []),
    ...(busy && !offline
      ? [line(t("location.cityOffer.busy"), NOTICE_LINE.REASON, Hourglass)]
      : []),
  ];

  const keptTitle =
    saved.city && shape !== OFFER_SHAPE.SAME_NAME
      ? t("location.cityOffer.kept.title", { saved: saved.city })
      : t("location.cityOffer.kept.titleHere");
  const keptBody = (() => {
    if (!saved.city) {
      return here ? t("location.cityOffer.kept.bodyNoSavedName", { city: here }) : null;
    }
    switch (shape) {
      case OFFER_SHAPE.NAMED:
        return t("location.cityOffer.kept.body", { saved: saved.city, city: here });
      case OFFER_SHAPE.SAME_NAME:
        return t("location.cityOffer.kept.bodyHere", { saved: saved.city });
      case OFFER_SHAPE.UNNAMED:
        return t("location.cityOffer.kept.bodyUnnamed", { saved: saved.city });
      default: {
        const unhandled: never = shape;
        return unhandled;
      }
    }
  })();

  const face = ((): Face => {
    switch (view) {
      case OFFER_VIEW.OFFER:
        return {
          icon: busy && !offline ? Hourglass : MapPin,
          tone: busy && !offline ? ICON_TILE_TONE.MUTED : ICON_TILE_TONE.ACCENT,
          eyebrow: t("location.cityChange.greeting"),
          title: offerTitle[shape],
          lines: [
            line(offerBody, NOTICE_LINE.BODY),
            ...(shape === OFFER_SHAPE.NAMED ? fact : []),
            ...reasons,
          ],
        };
      case OFFER_VIEW.UPDATING:
        return { icon: Hourglass, tone: ICON_TILE_TONE.MUTED, title: offerTitle[shape], lines: [] };
      case OFFER_VIEW.UPDATED:
        return {
          icon: Check,
          tone: ICON_TILE_TONE.SUCCESS,
          title: landedTitle,
          lines: [
            ...(offer.stage.kind === CITY_OFFER_STAGE.UPDATED && offer.stage.alertsFollow
              ? [
                  line(
                    landedShape === OFFER_SHAPE.NAMED
                      ? t("location.cityOffer.updated.body", { city: place.city })
                      : t("location.cityOffer.updated.bodyHere"),
                    NOTICE_LINE.BODY
                  ),
                ]
              : []),
            ...fact,
          ],
        };
      case OFFER_VIEW.STOPPED:
        return { icon: TriangleAlert, tone: ICON_TILE_TONE.WARN, title: landedTitle, lines: [] };
      case OFFER_VIEW.NOT_APPLIED:
        return {
          icon: CircleAlert,
          tone: ICON_TILE_TONE.MUTED,
          title: t("location.cityOffer.notApplied.title"),
          lines: [line(t("location.cityOffer.notApplied.body"), NOTICE_LINE.BODY)],
        };
      case OFFER_VIEW.KEPT:
        return {
          icon: Check,
          tone: ICON_TILE_TONE.ACCENT,
          title: keptTitle,
          lines: [...(keptBody ? [line(keptBody, NOTICE_LINE.BODY)] : []), ...fact],
        };
      case OFFER_VIEW.MUTED:
        return {
          icon: Check,
          tone: ICON_TILE_TONE.ACCENT,
          title:
            here && shape === OFFER_SHAPE.NAMED
              ? t("location.cityOffer.muted.title", { city: here })
              : t("location.cityOffer.muted.titleHere"),
          lines: [line(t("location.cityOffer.muted.body"), NOTICE_LINE.BODY)],
        };
      case OFFER_VIEW.FAILED:
        // The failure card draws itself.
        return { icon: CircleAlert, tone: ICON_TILE_TONE.DANGER, title: "", lines: [] };
      default: {
        const unhandled: never = view;
        return unhandled;
      }
    }
  })();

  // --- Saying it ------------------------------------------------------------
  const spoken = noticeLabel(t, face);
  const announce = useEffectEvent(() => {
    AccessibilityInfo.announceForAccessibility(spoken);
    useLocationStore.getState().markCityOfferAnnounced();
  });
  // An offer can arrive behind another app, where the words would be lost.
  const { isActive } = useAppVisibility();
  useEffect(() => {
    if (isActive && focused && view === OFFER_VIEW.OFFER && !offer.announced) announce();
  }, [isActive, focused, view, offer.announced]);
  // The card's own run announces the rest; this end has no run left to say it.
  const notApplied = view === OFFER_VIEW.NOT_APPLIED;
  useIosAnnouncement(notApplied ? spoken : null);

  // A later load landed the times this failed run could not.
  const landedSince =
    view === OFFER_VIEW.FAILED && liveRun?.step === UPDATE_STEP.PRAYER_TIMES && placeSettled;
  const settleLanded = useEffectEvent(() => {
    dismissFailure();
    useLocationStore
      .getState()
      .settleCityOffer({ kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: false });
  });
  useEffect(() => {
    if (landedSince) settleLanded();
  }, [landedSince]);

  // An action that removes the button under the finger moves focus to the copy.
  const textRef = useRef<ViewInstance>(null);
  const [acted, setActed] = useState(0);
  useViewFocus(acted, () => focusOn(textRef.current));
  const act = () => setActed((count) => count + 1);

  // --- Answers --------------------------------------------------------------
  const location = () => useLocationStore.getState();
  const startUpdate = async () => {
    act();
    location().startCityOfferUse({ city: saved.city, zone: saved.zone });
    const result = await applyCandidate(candidate);
    if (result.end !== RUN_END.LANDED) return;
    // The offer may have gone, or another taken its place, during the run.
    if (location().cityOffer?.candidate !== candidate) return;
    location().settleCityOffer({
      kind: CITY_OFFER_STAGE.UPDATED,
      alertsFollow: result.outcomes[UPDATE_STEP.NOTIFICATIONS] === STEP_OUTCOME.DONE,
    });
  };
  const leaveFailure = () => {
    dismissFailure();
    location().clearLocationFailure();
  };
  const keep = () => {
    act();
    if (view === OFFER_VIEW.FAILED) {
      leaveFailure();
      // Puts back a place this offer's runs wrote; with none written, no change.
      location().restorePreviousPlace();
      const times = usePrayerTimesStore.getState();
      // A failed refetch stays owed to a later load, which `timesSplit` forces.
      if (times.timesSplit) void times.loadPrayerTimesAtCurrentPlace().catch(() => {});
    }
    location().keepCityOffer();
  };
  const dontAsk = () => {
    act();
    location().muteCityOffer();
  };
  const close = () => {
    leaveFailure();
    location().dismissCityOffer();
  };
  const chooseCity = () => {
    close();
    router.push(locationPickerRoute(CITY_PICKER_VIEW.LIST));
  };

  // --- Actions --------------------------------------------------------------
  const keepAction: PairAction = {
    ...(saved.city && shape !== OFFER_SHAPE.SAME_NAME
      ? {
          label: t("location.cityOffer.keep", { saved: saved.city }),
          hint: t("a11y.location.cityOffer.keepHint", { saved: saved.city }),
        }
      : {
          label: t("location.cityOffer.keepSaved"),
          hint: t("a11y.location.cityOffer.keepSavedHint"),
        }),
    onPress: keep,
  };
  const update = () => void startUpdate();
  const useAction: PairAction = {
    ...(shape === OFFER_SHAPE.NAMED
      ? {
          label: t("location.cityOffer.use", { city: here }),
          hint: t("a11y.location.cityOffer.useHint", { city: here }),
        }
      : {
          label: t("location.cityOffer.useHere"),
          hint: t("a11y.location.cityOffer.useHereHint"),
        }),
    onPress: update,
    disabled: offline || busy,
  };
  const retryAction: PairAction = { label: t("common.retry"), icon: RefreshCw, onPress: update };
  const closeAction: PairAction = { label: t("common.close"), onPress: close };
  const dontAskLabel =
    here && shape === OFFER_SHAPE.NAMED
      ? t("location.cityOffer.dontAsk", { city: here })
      : t("location.cityOffer.dontAskHere");

  const actions = ((): ReactNode => {
    switch (view) {
      case OFFER_VIEW.OFFER:
        return (
          <VStack gap={TEXT_ACTION_GAP}>
            <ButtonPair primary={useAction} secondary={keepAction} />
            {shape === OFFER_SHAPE.UNNAMED ? <ChooseCityLink onPress={chooseCity} /> : null}
          </VStack>
        );
      case OFFER_VIEW.UPDATING:
        return run ? (
          <LocationUpdateProgress run={run} surface={LOCATION_UPDATE_SURFACE.FLAT} />
        ) : null;
      case OFFER_VIEW.STOPPED:
        return (
          <VStack gap="$3">
            {run ? (
              <LocationUpdateProgress run={run} surface={LOCATION_UPDATE_SURFACE.FLAT} />
            ) : null}
            <ButtonPair primary={retryAction} secondary={closeAction} />
          </VStack>
        );
      case OFFER_VIEW.NOT_APPLIED:
        return <ActionButton action={closeAction} />;
      case OFFER_VIEW.KEPT:
        return (
          <TextAction
            label={dontAskLabel}
            hint={t("a11y.location.cityOffer.dontAskHint")}
            onPress={dontAsk}
          />
        );
      case OFFER_VIEW.UPDATED:
      case OFFER_VIEW.MUTED:
      case OFFER_VIEW.FAILED:
        return null;
      default: {
        const unhandled: never = view;
        return unhandled;
      }
    }
  })();

  if (view === OFFER_VIEW.FAILED) {
    return (
      <LocationFailureOffer
        variant={FAILURE_OFFER_VARIANT.CARD}
        testID={CITY_OFFER_PART.CARD}
        // A failed read names its kind; a failure after it is the times'.
        failure={liveRun?.step === UPDATE_STEP.LOCATION ? storedFailure : null}
        city={shape === OFFER_SHAPE.NAMED ? (here ?? undefined) : undefined}
        // Once times have landed for the new place, the old one is not to keep.
        secondary={offer.placeLanded ? closeAction : keepAction}
        onRetry={update}
        onChooseCity={chooseCity}
      />
    );
  }

  return (
    <NoticeCard
      testID={CITY_OFFER_PART.CARD}
      icon={face.icon}
      tone={face.tone}
      eyebrow={face.eyebrow}
      title={face.title}
      lines={face.lines}
      live={notApplied}
      textRef={textRef}>
      {actions}
    </NoticeCard>
  );
};

/** The offer to update to the city the device is in, from ask to answer. */
export const CityChangeOffer = () => {
  const offer = useLocationStore((state) => state.cityOffer);
  return offer ? <OfferCard offer={offer} /> : null;
};
