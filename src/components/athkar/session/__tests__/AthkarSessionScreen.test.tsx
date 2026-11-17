import { screen, userEvent, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockStartAndJumpTo = jest.fn(async (_id: string) => {});
const mockPlay = jest.fn(async () => {});

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/services/athkar-player", () => ({
  athkarPlayer: {
    startAndJumpTo: (id: string) => mockStartAndJumpTo(id),
    play: () => mockPlay(),
  },
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
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/components/athkar/AudioOnboarding", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <Text>audio-onboarding</Text> : null),
  };
});

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import {
  ATHKAR_SESSION_SCREEN_PART,
  AthkarSessionScreen,
} from "@/components/athkar/session/AthkarSessionScreen";
import { SESSION_LIST_PART } from "@/components/athkar/session/SessionListSheet";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ATHKAR_FOCUS_HREF } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { renderWithTheme } from "@/test-helpers/theme";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { getTodayInt } from "@/utils/athkar";
/* eslint-enable import/first */

const ONBOARDING = "audio-onboarding";
const PERCENT = /%/;
// An open sheet hides its siblings from a reader; queries look past that.
const hidden = { includeHiddenElements: true };

const t = i18n.t.bind(i18n);

/** A text key no locale holds, so it draws as written. */
const textOf = (order: number) => `dhikr ${order}`;

const dhikr = (order: number): Athkar => ({
  id: `${order}-${ATHKAR_TYPE.MORNING}`,
  title: `title ${order}`,
  text: textOf(order),
  count: 3,
  type: ATHKAR_TYPE.MORNING,
  order,
});

const list = [dhikr(1), dhikr(2), dhikr(3)];
const mockInitialize = jest.fn(async () => {});

type Seed = { loaded?: boolean; counts?: Record<string, number> };

const seed = ({ loaded = true, counts = {} }: Seed = {}) =>
  useAthkarStore.setState({
    morningAthkarList: list,
    eveningAthkarList: [],
    currentType: ATHKAR_TYPE.MORNING,
    currentAthkarIndex: 0,
    lastMorningIndex: 0,
    lastEveningIndex: 0,
    advancePending: false,
    progressDay: loaded ? getTodayInt("Asia/Riyadh") : null,
    playerState: PLAYER_STATE.IDLE,
    currentAthkarId: null,
    initializeTodayData: mockInitialize,
    currentProgress: list.map((a) => ({
      athkarId: a.id,
      currentCount: counts[a.id] ?? 0,
      totalCount: a.count,
      completed: (counts[a.id] ?? 0) >= a.count,
    })),
  });

const ring = () => screen.queryByRole("button", { name: t("a11y.athkar.addCount"), ...hidden });
const position = () => screen.getByHintText(t("a11y.athkar.sessionListHint"));

beforeAll(() => useAppStore.setState({ locale: AppLocale.EN }));

beforeEach(() => {
  jest.clearAllMocks();
  mockInitialize.mockImplementation(async () => {});
  useAthkarAudioStore.setState({ onboardingCompleted: true });
  seed();
});

describe("AthkarSessionScreen", () => {
  it("shows the count ring and the place for a loaded session", async () => {
    await renderWithTheme(<AthkarSessionScreen />);

    expect(ring()).toBeOnTheScreen();
    expect(position()).toBeOnTheScreen();
    expect(screen.getByText(textOf(1))).toBeOnTheScreen();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it("holds the reader's place with a skeleton while the day loads", async () => {
    mockInitialize.mockImplementation(() => new Promise(() => {}));
    seed({ loaded: false });
    await renderWithTheme(<AthkarSessionScreen />);

    expect(screen.getByTestId(ATHKAR_SESSION_SCREEN_PART.LOADING)).toBeOnTheScreen();
    expect(ring()).toBeNull();
  });

  it("opens the list from the place, and a row opens its dhikr", async () => {
    await renderWithTheme(<AthkarSessionScreen />);
    expect(screen.queryByTestId(SESSION_LIST_PART.ROW, hidden)).toBeNull();

    await userEvent.press(position());
    const rows = screen.getAllByTestId(SESSION_LIST_PART.ROW, hidden);
    expect(rows).toHaveLength(list.length);

    await userEvent.press(rows[2]);
    expect(useAthkarStore.getState().currentAthkarIndex).toBe(2);
    expect(screen.queryByTestId(SESSION_LIST_PART.ROW, hidden)).toBeNull();
    expect(screen.getByText(textOf(3))).toBeOnTheScreen();
  });

  it.each([
    ["the load rejects", () => Promise.reject(new Error("no database"))],
    ["the load ends with no day", async () => {}],
  ])("offers a retry when %s", async (_case, load) => {
    mockInitialize.mockImplementation(load);
    seed({ loaded: false });
    await renderWithTheme(<AthkarSessionScreen />);

    const retry = await screen.findByRole("button", { name: t("common.retry") });
    expect(screen.getByText(t("athkar.session.loadError.title"))).toBeOnTheScreen();

    mockInitialize.mockImplementation(async () => {
      seed();
    });
    await userEvent.press(retry);

    await waitFor(() => expect(ring()).toBeOnTheScreen());
    expect(mockInitialize).toHaveBeenCalledTimes(2);
  });

  it.each([
    [ATHKAR_TYPE.MORNING, "athkar.morning"],
    [ATHKAR_TYPE.EVENING, "athkar.evening"],
  ] as const)("says a finished %s session is complete, with no score", async (type, name) => {
    seed({ counts: Object.fromEntries(list.map((a) => [a.id, a.count])) });
    useAthkarStore.setState({ currentType: type, eveningAthkarList: list });
    await renderWithTheme(<AthkarSessionScreen />);

    expect(screen.getByText(t("athkar.session.done", { type: t(name) }))).toBeOnTheScreen();
    expect(ring()).toBeNull();
    expect(screen.queryByText(PERCENT)).toBeNull();
  });

  it("opens Focus from its row", async () => {
    await renderWithTheme(<AthkarSessionScreen />);
    await userEvent.press(screen.getByText(t("athkar.session.focus.title")));
    expect(mockPush).toHaveBeenCalledWith(ATHKAR_FOCUS_HREF);
  });

  describe("audio", () => {
    const start = () =>
      userEvent.press(screen.getByRole("button", { name: t("a11y.athkar.startAudioSession") }));

    it("starts the audio session on the current dhikr", async () => {
      await renderWithTheme(<AthkarSessionScreen />);
      await start();
      expect(mockStartAndJumpTo).toHaveBeenCalledWith(list[0].id);
    });

    it("sets audio up first for a person who has not chosen a reciter", async () => {
      useAthkarAudioStore.setState({ onboardingCompleted: false });
      await renderWithTheme(<AthkarSessionScreen />);
      await start();
      expect(screen.getByText(ONBOARDING)).toBeOnTheScreen();
      expect(mockStartAndJumpTo).not.toHaveBeenCalled();
    });

    it("resumes a paused session where it stopped", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.PAUSED, currentAthkarId: list[0].id });
      await renderWithTheme(<AthkarSessionScreen />);
      await start();
      expect(mockPlay).toHaveBeenCalledTimes(1);
      expect(mockStartAndJumpTo).not.toHaveBeenCalled();
    });
  });
});
