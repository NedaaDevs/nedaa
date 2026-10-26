import type { UpdateRun } from "@/stores/locationUpdate";
import type { ManualLocation } from "@/types/location";

const NO_NAMES = { ar: null, ur: null, ms: null };

/** The place every stub hands to its host. */
export const PLACE: ManualLocation = {
  cityId: 1,
  name: "Riyadh",
  names: NO_NAMES,
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: NO_NAMES },
  latitude: 24.7,
  longitude: 46.7,
  timezone: "Asia/Riyadh",
};

/** Triggers of the city picker stub, set while it is drawn. */
export const pickerStub: { pick?: () => void; onEnterCoordinates?: () => void } = {};
/** Triggers of the coordinate entry stub, set while it is drawn. */
export const coordinatesStub: { save?: () => void } = {};

type UpdateStub = { run: UpdateRun | null; applyManualLocation: jest.Mock; retry: jest.Mock };
/** The location update the stubbed hook returns; every pick lands. */
export const updateStub: UpdateStub = {
  run: null,
  applyManualLocation: jest.fn(async (_place: unknown) => true),
  retry: jest.fn(async () => true),
};

const CityPickerStub = (props: {
  onPick: (place: ManualLocation) => void;
  onEnterCoordinates: () => void;
}) => {
  pickerStub.pick = () => props.onPick(PLACE);
  pickerStub.onEnterCoordinates = props.onEnterCoordinates;
  return null;
};

const CoordinateEntryStub = (props: { onSave: (place: ManualLocation) => void }) => {
  coordinatesStub.save = () => props.onSave(PLACE);
  return null;
};

/** Stands in for the CityPicker module. */
export const cityPickerModule = { __esModule: true, default: CityPickerStub };
/** Stands in for the CoordinateEntry module. */
export const coordinateEntryModule = { __esModule: true, default: CoordinateEntryStub };
/** Stands in for the useLocationUpdate module. */
export const locationUpdateModule = { useLocationUpdate: () => updateStub };

/** Clears every trigger and the update; run it in `beforeEach`. */
export const resetPickerStubs = () => {
  delete pickerStub.pick;
  delete pickerStub.onEnterCoordinates;
  delete coordinatesStub.save;
  updateStub.run = null;
  updateStub.applyManualLocation.mockReset().mockResolvedValue(true);
  updateStub.retry.mockReset().mockResolvedValue(true);
};
