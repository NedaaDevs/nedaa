import { screen, userEvent } from "@testing-library/react-native";

import AthkarTabs, { TAB_LABEL_MIN_SCALE } from "@/components/athkar/AthkarTabs";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { PLAYER_STATE } from "@/types/athkar-audio";

type Period = typeof ATHKAR_TYPE.MORNING | typeof ATHKAR_TYPE.EVENING;

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
jest.mock("@/components/athkar/session/AthkarSessionScreen", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { AthkarSessionScreen: () => <Text>session-screen</Text> };
});
jest.mock("@/components/athkar/MyAthkarList", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: () => <Text>my-athkar-list</Text> };
});

const SESSION = "session-screen";
const MY_ATHKAR = "my-athkar-list";

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

  it.each([ATHKAR_TYPE.MORNING, ATHKAR_TYPE.EVENING])(
    "shows the session on the %s tab, with no streak and no floating button",
    async (period) => {
      mockPeriod = period;
      await renderWithTheme(<AthkarTabs />);

      expect(screen.getByText(SESSION)).toBeOnTheScreen();
      expect(screen.queryByText(MY_ATHKAR)).toBeNull();
      expect(screen.queryByText(i18n.t("athkar.dailyStreak"))).toBeNull();
      expect(screen.queryByLabelText(i18n.t("athkar.enterFocusMode"))).toBeNull();
    }
  );

  it.each([
    ["athkar.morning", "athkar.tab.morning"],
    ["athkar.evening", "athkar.tab.evening"],
  ] as const)("speaks %s in full and draws the short %s", async (full, short) => {
    await renderWithTheme(<AthkarTabs />);

    expect(tab(full)).toHaveTextContent(i18n.t(short));
    expect(i18n.t(short)).not.toBe(short);
    expect(screen.queryByText(i18n.t(full))).toBeNull();
  });

  it.each(["athkar.tab.morning", "athkar.tab.evening", "athkar.myAthkar"])(
    "holds the %s label to one line, shrinking before it wraps",
    async (key) => {
      await renderWithTheme(<AthkarTabs />);

      const label = screen.getByText(i18n.t(key));
      expect(label).toHaveProp("numberOfLines", 1);
      expect(label).toHaveProp("adjustsFontSizeToFit", true);
      expect(label).toHaveProp("minimumFontScale", TAB_LABEL_MIN_SCALE);
      // Android shrinks a label only inside a fixed width.
      expect(label).toHaveStyle({ alignSelf: "stretch" });
    }
  );

  it("keeps the My Athkar list on its tab", async () => {
    await renderWithTheme(<AthkarTabs />);
    await userEvent.press(tab("athkar.myAthkar"));

    expect(screen.getByText(MY_ATHKAR)).toBeOnTheScreen();
    expect(screen.queryByText(SESSION)).toBeNull();
    expect(tab("athkar.myAthkar").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("moves the session to the pressed period", async () => {
    await renderWithTheme(<AthkarTabs />);
    await userEvent.press(tab("athkar.evening"));

    expect(mockStore.setCurrentType).toHaveBeenLastCalledWith(ATHKAR_TYPE.EVENING);
    expect(tab("athkar.evening").props.accessibilityState).toMatchObject({ selected: true });
  });
});
