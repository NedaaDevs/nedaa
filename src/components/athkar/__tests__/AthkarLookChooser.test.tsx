import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import type { getCurrentAthkarPeriod } from "@/utils/athkar";

const mockBack = jest.fn();
const mockNavigate = jest.fn();
let mockSeedPeriod: ReturnType<typeof getCurrentAthkarPeriod> | null = null;
let mockFocused = true;
let mockBehind: string | undefined;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, navigate: mockNavigate }),
  useIsFocused: () => mockFocused,
}));
jest.mock("@/components/ui/screen-header/useBackDestination", () => ({
  useBackDestination: () => mockBehind,
}));
jest.mock("@/services/athkar-player", () => ({
  athkarPlayer: { startAndJumpTo: jest.fn(), play: jest.fn(), stop: jest.fn() },
}));
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
// The real database is SQLite, which jest lacks.
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    updateAthkarCount: jest.fn(async () => true),
    checkAndMarkSessionComplete: jest.fn(async () => {}),
    areBothSessionsCompleted: jest.fn(async () => false),
    updateStreakForDay: jest.fn(async () => {}),
    getStreakData: jest.fn(async () => null),
    validateStreakForToday: jest.fn(async () => {}),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/constants/AthkarLook", () =>
  jest.requireActual("@/test-helpers/athkarLooks").lookConstantsWithTestLook()
);
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);
jest.mock("@/components/athkar/AudioOnboarding", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/athkar/MyAthkarList", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/athkar/useAthkarScreenshotSeed", () => ({
  useAthkarLandingScreenshotSeed: () => mockSeedPeriod,
}));
jest.mock("@/hooks/useInitializeAthkar", () => ({ useInitializeAthkar: () => {} }));
jest.mock("@/hooks/useTabBarInset", () => ({ useTabBarInset: () => 0 }));
jest.mock("@/utils/athkar", () => ({
  ...jest.requireActual("@/utils/athkar"),
  getCurrentAthkarPeriod: () => jest.requireActual("@/constants/Athkar").ATHKAR_TYPE.MORNING,
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import AthkarTabs from "@/components/athkar/AthkarTabs";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ATHKAR_LOOK, type AthkarLookId } from "@/constants/AthkarLook";
import { CHOOSER_MODE } from "@/constants/AthkarLookChooser";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";
import { TEST_LOOK_ID, TEST_LOOK_NAME, TEST_LOOK_PART } from "@/test-helpers/athkarLooks";
import { holdHydration } from "@/test-helpers/hydration";
import { renderWithTheme } from "@/test-helpers/theme";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { getTodayInt } from "@/utils/athkar";
/* eslint-enable import/first */

const t = i18n.t.bind(i18n);
const TARGET = 3;

const dhikr = (order: number): Athkar => ({
  id: `${order}-${ATHKAR_TYPE.MORNING}`,
  title: `title ${order}`,
  text: `dhikr ${order}`,
  count: TARGET,
  type: ATHKAR_TYPE.MORNING,
  order,
});
const list = [dhikr(1), dhikr(2)];

const seed = (look: AthkarLookId | null) =>
  useAthkarStore.setState((state) => ({
    settings: { ...state.settings, look },
    morningAthkarList: list,
    eveningAthkarList: [],
    currentType: ATHKAR_TYPE.MORNING,
    currentAthkarIndex: 0,
    lastMorningIndex: 0,
    lastEveningIndex: 0,
    advancePending: false,
    progressDay: getTodayInt("Asia/Riyadh"),
    playerState: PLAYER_STATE.IDLE,
    currentAthkarId: null,
    initializeTodayData: jest.fn(async () => {}),
    currentProgress: list.map((a) => ({
      athkarId: a.id,
      currentCount: 0,
      totalCount: a.count,
      completed: false,
    })),
  }));

const CLASSIC_NAME = t("athkar.look.name.classic");
const dockTitle = () => screen.queryByRole("header", { name: t("athkar.look.choose") });
const option = (name: string) => screen.getByRole("radio", { name });
const confirm = () => screen.getByRole("button", { name: t("athkar.look.use") });
const back = () => screen.queryByRole("button", { name: t("common.back") });
const ring = () => screen.getByRole("button", { name: t("a11y.athkar.addCount") });
const tab = (key: "athkar.morning" | "athkar.evening") => screen.getByRole("tab", { name: t(key) });
const myAthkar = () => screen.queryByRole("tab", { name: t("athkar.myAthkar") });
const storedLook = () => useAthkarStore.getState().settings.look;
const barCovered = () => useTabBarFrameStore.getState().covers > 0;

let announce: jest.SpyInstance;

beforeAll(() => useAppStore.setState({ locale: AppLocale.EN }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSeedPeriod = null;
  mockFocused = true;
  mockBehind = BACK_DESTINATION.SETTINGS.route;
  seed(null);
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
});
afterEach(() => announce.mockRestore());

describe("the look chooser on a first visit", () => {
  it("opens over the reader with every look, the confirm button and the later-change line", async () => {
    await renderWithTheme(<AthkarTabs />);

    expect(dockTitle()).toBeOnTheScreen();
    expect(option(CLASSIC_NAME)).toBeSelected();
    expect(option(TEST_LOOK_NAME)).not.toBeSelected();
    expect(confirm()).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.look.changeLater"))).toBeOnTheScreen();
    expect(back()).toBeNull();
    expect(ring()).toBeOnTheScreen();
  });

  it("takes the tab bar's place, and keeps My Athkar out of the way", async () => {
    await renderWithTheme(<AthkarTabs />);

    expect(barCovered()).toBe(true);
    expect(myAthkar()).toBeNull();
  });

  it("gives the tab bar back while another screen is in front, and when it closes", async () => {
    const view = await renderWithTheme(<AthkarTabs />);

    mockFocused = false;
    await view.rerender(<AthkarTabs />);
    expect(barCovered()).toBe(false);

    mockFocused = true;
    await view.rerender(<AthkarTabs />);
    expect(barCovered()).toBe(true);

    await view.unmount();
    expect(barCovered()).toBe(false);
  });

  it("waits for the stored choice to load", async () => {
    const hold = holdHydration(useAthkarStore);
    try {
      await renderWithTheme(<AthkarTabs />);
      expect(dockTitle()).toBeNull();

      await act(() => hold.land());
      expect(dockTitle()).toBeOnTheScreen();
    } finally {
      hold.restore();
    }
  });

  it("stays away once a look is chosen", async () => {
    seed(ATHKAR_LOOK.CLASSIC);
    await renderWithTheme(<AthkarTabs />);

    expect(dockTitle()).toBeNull();
    expect(barCovered()).toBe(false);
    expect(myAthkar()).toBeOnTheScreen();
  });

  it("stays away in a screenshot run", async () => {
    mockSeedPeriod = ATHKAR_TYPE.MORNING;
    await renderWithTheme(<AthkarTabs />);

    expect(dockTitle()).toBeNull();
    expect(barCovered()).toBe(false);
    expect(ring()).toBeOnTheScreen();
  });

  it("stores the look it opened on when a person confirms without picking", async () => {
    await renderWithTheme(<AthkarTabs />);
    await userEvent.press(confirm());

    expect(storedLook()).toBe(ATHKAR_LOOK.CLASSIC);
    expect(announce).toHaveBeenCalledWith(t("a11y.athkar.lookChosen", { name: CLASSIC_NAME }));
    expect(dockTitle()).toBeNull();
  });

  it("puts the reader in the look a person picks, and the count comes along", async () => {
    await renderWithTheme(<AthkarTabs />);
    await userEvent.press(ring());
    await userEvent.press(option(TEST_LOOK_NAME));

    expect(option(TEST_LOOK_NAME)).toBeSelected();
    expect(screen.getByTestId(TEST_LOOK_PART.TRYING)).toBeOnTheScreen();
    expect(screen.getByTestId(TEST_LOOK_PART.COUNT)).toHaveTextContent("1");
    expect(storedLook()).toBeNull();
  });

  it("stores the picked look, says so, and leaves the reader where it was", async () => {
    await renderWithTheme(<AthkarTabs />);
    await userEvent.press(option(TEST_LOOK_NAME));
    await userEvent.press(screen.getByTestId(TEST_LOOK_PART.READER));
    const reader = screen.getByTestId(TEST_LOOK_PART.READER);
    await userEvent.press(confirm());

    expect(storedLook()).toBe(TEST_LOOK_ID);
    expect(announce).toHaveBeenCalledWith(t("a11y.athkar.lookChosen", { name: TEST_LOOK_NAME }));
    expect(dockTitle()).toBeNull();
    expect(screen.getByTestId(TEST_LOOK_PART.READER)).toBe(reader);
    expect(screen.getByTestId(TEST_LOOK_PART.COUNT)).toHaveTextContent("1");
    expect(screen.queryByTestId(TEST_LOOK_PART.TRYING)).toBeNull();
    expect(barCovered()).toBe(false);
    expect(myAthkar()).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe("the look chooser from settings", () => {
  const renderChooser = () => renderWithTheme(<AthkarTabs chooser={CHOOSER_MODE.SETTINGS} />);

  it("opens on the stored look, names it, and leaves the tab bar alone", async () => {
    seed(TEST_LOOK_ID);
    await renderChooser();

    expect(option(TEST_LOOK_NAME)).toBeSelected();
    expect(screen.getByText(t("athkar.look.current", { name: TEST_LOOK_NAME }))).toBeOnTheScreen();
    expect(screen.queryByText(t("athkar.look.changeLater"))).toBeNull();
    expect(barCovered()).toBe(false);
  });

  it("opens on the session's period and leaves it there", async () => {
    seed(ATHKAR_LOOK.CLASSIC);
    useAthkarStore.setState({ currentType: ATHKAR_TYPE.EVENING });
    await renderChooser();

    expect(tab("athkar.evening")).toBeSelected();
    expect(useAthkarStore.getState().currentType).toBe(ATHKAR_TYPE.EVENING);
  });

  it.each([
    ["the back control", back],
    ["the confirm button", confirm],
  ])("goes to Athkar from %s when no screen is behind it", async (_, control) => {
    mockBehind = undefined;
    seed(ATHKAR_LOOK.CLASSIC);
    await renderChooser();
    await userEvent.press(control()!);

    expect(mockNavigate).toHaveBeenCalledWith(BACK_DESTINATION.ATHKAR.href);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("goes back without a change from the back control", async () => {
    seed(ATHKAR_LOOK.CLASSIC);
    await renderChooser();
    await userEvent.press(option(TEST_LOOK_NAME));
    await userEvent.press(back()!);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(storedLook()).toBe(ATHKAR_LOOK.CLASSIC);
    expect(announce).not.toHaveBeenCalled();
  });

  it("stores the picked look, says so, and goes back", async () => {
    seed(ATHKAR_LOOK.CLASSIC);
    await renderChooser();
    await userEvent.press(option(TEST_LOOK_NAME));
    await userEvent.press(confirm());

    expect(storedLook()).toBe(TEST_LOOK_ID);
    expect(announce).toHaveBeenCalledWith(t("a11y.athkar.lookChosen", { name: TEST_LOOK_NAME }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
