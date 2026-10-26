import { screen } from "@testing-library/react-native";

import AthkarTabs from "@/components/athkar/AthkarTabs";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { PLAYER_STATE } from "@/types/athkar-audio";
import type { AthkarType } from "@/types/athkar";

type Period = Exclude<AthkarType, typeof ATHKAR_TYPE.ALL>;

const mockStore = {
  setCurrentType: jest.fn(),
  validateDailyStreak: jest.fn(),
  playerState: PLAYER_STATE.IDLE,
};
// The real store opens its database; the tabs read only these three.
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: (select: (state: typeof mockStore) => unknown = (state) => state) =>
    select(mockStore),
}));

let mockPeriod: Period;
let mockSeedPeriod: Period | null = null;
jest.mock("@/utils/athkar", () => ({
  ...jest.requireActual("@/utils/athkar"),
  getCurrentAthkarPeriod: () => mockPeriod,
}));
jest.mock("@/components/athkar/useAthkarScreenshotSeed", () => ({
  useAthkarLandingScreenshotSeed: () => mockSeedPeriod,
}));
jest.mock("@/hooks/useInitializeAthkar", () => ({ useInitializeAthkar: () => {} }));
jest.mock("@/hooks/useTabBarInset", () => ({ useTabBarInset: () => 0 }));
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: { stop: jest.fn() } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/athkar/AthkarList", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/athkar/MyAthkarList", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/athkar/AudioOnboarding", () => ({
  __esModule: true,
  default: () => null,
}));

const tab = (key: string) => screen.getByRole("tab", { name: i18n.t(key) });

describe("AthkarTabs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPeriod = ATHKAR_TYPE.MORNING;
    mockSeedPeriod = null;
  });

  it("opens on the current period and checks the streak once", async () => {
    mockPeriod = ATHKAR_TYPE.EVENING;
    const { rerender } = await renderWithTheme(<AthkarTabs />);
    await rerender(<AthkarTabs />);

    expect(tab("athkar.evening").props.accessibilityState).toMatchObject({ selected: true });
    expect(mockStore.setCurrentType).toHaveBeenCalledWith(ATHKAR_TYPE.EVENING);
    expect(mockStore.validateDailyStreak).toHaveBeenCalledTimes(1);
  });

  it("opens on the seeded period in a screenshot run", async () => {
    mockSeedPeriod = ATHKAR_TYPE.EVENING;
    await renderWithTheme(<AthkarTabs />);

    expect(tab("athkar.evening").props.accessibilityState).toMatchObject({ selected: true });
    expect(tab("athkar.morning").props.accessibilityState).toMatchObject({ selected: false });
    expect(mockStore.setCurrentType).toHaveBeenLastCalledWith(ATHKAR_TYPE.EVENING);
  });
});
