import { CITY_OFFER_STAGE, OFFER_SHAPE, OFFER_VIEW } from "@/constants/CityOffer";
import { UPDATE_START, UPDATE_STEP, type UpdateStep } from "@/constants/Location";
import { offerShapeOf, offerViewOf, ownRunOf } from "@/components/location/cityOfferView";
import type { UpdateRun } from "@/stores/locationUpdate";
import { candidateAt } from "@/test-helpers/cityOffer";

const CANDIDATE = candidateAt();
const runFrom = (kind: typeof UPDATE_START.DEVICE | typeof UPDATE_START.CANDIDATE): UpdateRun => ({
  start: kind === UPDATE_START.CANDIDATE ? { kind, candidate: CANDIDATE } : { kind },
  step: UPDATE_STEP.LOCATION,
  failed: false,
});
const running = (step: UpdateStep): UpdateRun => ({ ...runFrom(UPDATE_START.CANDIDATE), step });
const failed = (step: UpdateStep): UpdateRun => ({ ...running(step), failed: true });

describe("offerShapeOf", () => {
  it.each([
    [{ here: "Jeddah", saved: "Riyadh" }, OFFER_SHAPE.NAMED],
    [{ here: "Riyadh", saved: "Riyadh" }, OFFER_SHAPE.SAME_NAME],
    [{ here: null, saved: "Riyadh" }, OFFER_SHAPE.UNNAMED],
    [{ here: "Jeddah", saved: null }, OFFER_SHAPE.NAMED],
    [{ here: null, saved: null }, OFFER_SHAPE.UNNAMED],
  ])("shapes %o as %s", (names, shape) => expect(offerShapeOf(names)).toBe(shape));
});

describe("offerViewOf", () => {
  it.each([
    [CITY_OFFER_STAGE.OFFER, null, true, OFFER_VIEW.OFFER],
    [CITY_OFFER_STAGE.OFFER, running(UPDATE_STEP.PRAYER_TIMES), false, OFFER_VIEW.UPDATING],
    [CITY_OFFER_STAGE.OFFER, failed(UPDATE_STEP.LOCATION), true, OFFER_VIEW.FAILED],
    [CITY_OFFER_STAGE.OFFER, failed(UPDATE_STEP.LOCATION), false, OFFER_VIEW.NOT_APPLIED],
    [CITY_OFFER_STAGE.OFFER, failed(UPDATE_STEP.PRAYER_TIMES), false, OFFER_VIEW.FAILED],
    [CITY_OFFER_STAGE.OFFER, failed(UPDATE_STEP.NOTIFICATIONS), false, OFFER_VIEW.STOPPED],
    [CITY_OFFER_STAGE.OFFER, failed(UPDATE_STEP.ALARMS), false, OFFER_VIEW.STOPPED],
    [CITY_OFFER_STAGE.KEPT, null, false, OFFER_VIEW.KEPT],
    [CITY_OFFER_STAGE.MUTED, null, false, OFFER_VIEW.MUTED],
    [CITY_OFFER_STAGE.UPDATED, null, false, OFFER_VIEW.UPDATED],
  ])("draws %s with run %o, read failed %s, as %s", (stage, run, readFailed, view) =>
    expect(offerViewOf({ stage, run, readFailed })).toBe(view)
  );
});

describe("ownRunOf", () => {
  it("takes only the run of this offer's candidate", () => {
    expect(ownRunOf(runFrom(UPDATE_START.DEVICE), CANDIDATE)).toBeNull();
    expect(ownRunOf(runFrom(UPDATE_START.CANDIDATE), CANDIDATE)).not.toBeNull();
    expect(ownRunOf(null, CANDIDATE)).toBeNull();
  });

  it("drops a run for a candidate at another point", () => {
    const elsewhere = candidateAt({ point: { latitude: 25.2, longitude: 55.27 } });
    expect(ownRunOf(runFrom(UPDATE_START.CANDIDATE), elsewhere)).toBeNull();
  });
});
