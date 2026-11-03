import { CITY_OFFER_STAGE, OFFER_SHAPE, OFFER_VIEW } from "@/constants/CityOffer";
import type { CityOfferStageKind, OfferShape, OfferView } from "@/constants/CityOffer";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { isRunning, type UpdateRun } from "@/stores/locationUpdate";
import type { CityCandidate } from "@/types/cityCheck";

/** How the device's city and the saved city name each other. */
export const offerShapeOf = ({
  here,
  saved,
}: {
  here: string | null;
  saved: string | null;
}): OfferShape => {
  if (here === null) return OFFER_SHAPE.UNNAMED;
  return here === saved ? OFFER_SHAPE.SAME_NAME : OFFER_SHAPE.NAMED;
};

/** The run, only when it applies this offer's candidate. */
export const ownRunOf = (run: UpdateRun | null, candidate: CityCandidate): UpdateRun | null => {
  if (run?.start.kind !== UPDATE_START.CANDIDATE) return null;
  const { point } = run.start.candidate;
  const same =
    point.latitude === candidate.point.latitude && point.longitude === candidate.point.longitude;
  return same ? run : null;
};

type Facts = {
  stage: CityOfferStageKind;
  /** The offer's own run. */
  run: UpdateRun | null;
  /** The device read failed and stored why; not a place that moved. */
  readFailed: boolean;
};

/** Which view the card draws: the stage, then the offer's own run. */
export const offerViewOf = ({ stage, run, readFailed }: Facts): OfferView => {
  switch (stage) {
    case CITY_OFFER_STAGE.KEPT:
      return OFFER_VIEW.KEPT;
    case CITY_OFFER_STAGE.MUTED:
      return OFFER_VIEW.MUTED;
    case CITY_OFFER_STAGE.UPDATED:
      return OFFER_VIEW.UPDATED;
    case CITY_OFFER_STAGE.OFFER:
      break;
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
  if (!run) return OFFER_VIEW.OFFER;
  if (isRunning(run)) return OFFER_VIEW.UPDATING;
  if (run.step === UPDATE_STEP.LOCATION) {
    // A stop with no stored read failure is a place that moved under the offer.
    return readFailed ? OFFER_VIEW.FAILED : OFFER_VIEW.NOT_APPLIED;
  }
  return run.step === UPDATE_STEP.PRAYER_TIMES ? OFFER_VIEW.FAILED : OFFER_VIEW.STOPPED;
};
