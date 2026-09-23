import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";

// The phone is dark when the store is created, as on a first launch at night. A mock
// factory runs before imports, so it spells the scheme rather than naming a constant.
jest.mock("react-native", () => {
  const reactNative = jest.requireActual("react-native");
  reactNative.Appearance.getColorScheme = () => "dark";
  return reactNative;
});

describe("app store on a fresh install", () => {
  // Pinning the phone's scheme of the moment would stop the app following it later.
  it("follows the phone rather than pinning its current scheme", () => {
    expect(useAppStore.getInitialState().mode).toBe(AppMode.SYSTEM);
  });
});
