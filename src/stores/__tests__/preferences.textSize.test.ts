import { usePreferencesStore } from "@/stores/preferences";
import { TextSize } from "@/enums/app";
import { nearestTextSize, TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("preferences text size", () => {
  test("defaults", () => {
    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
    expect(usePreferencesStore.getState().textSizeOfferHandled).toBe(false);
  });

  test("setTextSize stores the preset and settles the offer", () => {
    usePreferencesStore.getState().setTextSize(TextSize.XLARGE);
    expect(usePreferencesStore.getState().textSize).toBe(TextSize.XLARGE);
    expect(usePreferencesStore.getState().textSizeOfferHandled).toBe(true);
  });

  test("markTextSizeOfferHandled settles without a preset change", () => {
    usePreferencesStore.setState({ textSize: TextSize.DEFAULT, textSizeOfferHandled: false });
    usePreferencesStore.getState().markTextSizeOfferHandled();
    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
    expect(usePreferencesStore.getState().textSizeOfferHandled).toBe(true);
  });

  test("multiplier table", () => {
    expect(TEXT_SIZE_MULTIPLIERS[TextSize.DEFAULT]).toBe(1.0);
    expect(TEXT_SIZE_MULTIPLIERS[TextSize.MAX]).toBe(1.5);
  });

  test.each([
    [1.0, TextSize.LARGE], // caller gates on the threshold; below it the fn still returns the floor preset
    [1.15, TextSize.LARGE],
    [1.2, TextSize.LARGE],
    [1.25, TextSize.XLARGE], // ≥ midpoint 1.225 rounds up
    [1.3, TextSize.XLARGE],
    [1.39, TextSize.XLARGE],
    [1.45, TextSize.MAX], // ≥ midpoint 1.4 rounds up
    [2.0, TextSize.MAX],
  ])("nearestTextSize(%f) → %s", (scale, expected) => {
    expect(nearestTextSize(scale)).toBe(expected);
  });
});
