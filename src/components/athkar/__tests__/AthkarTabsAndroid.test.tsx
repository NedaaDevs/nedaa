import { screen } from "@testing-library/react-native";

import AthkarTabs from "@/components/athkar/AthkarTabs";
import { TEXT_END_ROOM } from "@/components/ui/text";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { PLAYER_STATE } from "@/types/athkar-audio";

// The text primitive reads the platform once, at load; this file runs as Android.
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const { PlatformType } = jest.requireActual("@/enums/app");
  native.Platform.OS = PlatformType.ANDROID;
  return native;
});

const mockStore = {
  setCurrentType: jest.fn(),
  validateDailyStreak: jest.fn(),
  playerState: PLAYER_STATE.IDLE,
};
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: (select: (state: typeof mockStore) => unknown = (state) => state) =>
    select(mockStore),
}));
jest.mock("@/components/athkar/useAthkarScreenshotSeed", () => ({
  useAthkarLandingScreenshotSeed: () => null,
}));
jest.mock("@/hooks/useInitializeAthkar", () => ({ useInitializeAthkar: () => {} }));
jest.mock("@/hooks/useTabBarInset", () => ({ useTabBarInset: () => 0 }));
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: { stop: jest.fn() } }));
jest.mock("@/components/athkar/session/AthkarSessionScreen", () => ({
  AthkarSessionScreen: () => null,
}));
jest.mock("@/components/athkar/MyAthkarList", () => ({ __esModule: true, default: () => null }));

describe("AthkarTabs on Android", () => {
  // The tab pads its label; the text primitive's end room would take the
  // width the longest label needs at the largest text size.
  it.each(["athkar.tab.morning", "athkar.tab.evening", "athkar.myAthkar"])(
    "gives the %s label the tab's whole width",
    async (key) => {
      await renderWithTheme(<AthkarTabs />);

      expect(TEXT_END_ROOM).toBeGreaterThan(0);
      expect(screen.getByText(i18n.t(key))).not.toHaveStyle({ paddingEnd: TEXT_END_ROOM });
    }
  );
});
