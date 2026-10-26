import { dropCityTriedSince } from "@/components/onboarding/flow/CityChoice";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";

// The module draws the city search; its field reads the sheet context.
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));

const RUN_START = 10_000;
const clear = jest.fn();

beforeEach(() => {
  clear.mockClear();
  useLocationStore.setState({ clearManualLocation: clear });
});

describe("dropCityTriedSince", () => {
  it.each([
    ["a city picked in this run", 1, LocationMode.MANUAL, RUN_START + 1],
    ["a city picked as the run starts", 1, LocationMode.MANUAL, RUN_START],
    ["a city stored before the run", 0, LocationMode.MANUAL, RUN_START - 1],
    ["a manual mode with no pick time", 0, LocationMode.MANUAL, null],
    ["the device's own place", 0, LocationMode.DEVICE, RUN_START + 1],
  ])("clears %s %i time(s)", (_, clears, locationMode, manualLocationChosenAt) => {
    useLocationStore.setState({ locationMode, manualLocationChosenAt });

    dropCityTriedSince(RUN_START);

    expect(clear).toHaveBeenCalledTimes(clears);
  });
});
