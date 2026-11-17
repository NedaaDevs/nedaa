import { AccessibilityInfo } from "react-native";
import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";

const mockBack = jest.fn();
const mockPlayer = {
  startAndJumpTo: jest.fn(async (_id: string) => {}),
  play: jest.fn(async () => {}),
  pause: jest.fn(async () => {}),
  stop: jest.fn(async () => {}),
  jumpTo: jest.fn(async (_id: string) => {}),
};

jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("@/services/athkar-player", () => ({
  // Read at use: the factory runs before `mockPlayer` holds its value.
  get athkarPlayer() {
    return mockPlayer;
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
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);
jest.mock("@/components/athkar/AudioOnboarding", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <Text>audio-onboarding</Text> : null),
  };
});

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { FOCUS_STAGE_PART } from "@/components/athkar/session/FocusStage";
import {
  ATHKAR_FOCUS_SCREEN_PART,
  AthkarFocusScreen,
} from "@/components/athkar/session/AthkarFocusScreen";
import { SESSION_DONE_ID } from "@/components/athkar/session/SessionDone";
import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { FOCUS_ACTION } from "@/constants/AthkarFocus";
import { AppLocale } from "@/enums/app";
import { FOCUS_GESTURE_ID } from "@/hooks/useFocusGesture";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { TEST_LOOK_ID, TEST_LOOK_PART } from "@/test-helpers/athkarLooks";
import { renderWithTheme } from "@/test-helpers/theme";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { getTodayInt } from "@/utils/athkar";
/* eslint-enable import/first */

const ONBOARDING = "audio-onboarding";
const CELEBRATION = /%|\p{Extended_Pictographic}/u;
const STILL = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, y: 0 };
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
const allDone = Object.fromEntries(list.map((a) => [a.id, a.count]));

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
    focusHintSeen: false,
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

/** The screen on the sky its route draws. */
const renderFocus = () =>
  renderWithTheme(
    <SkyBackground>
      <AthkarFocusScreen />
    </SkyBackground>
  );

const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const doneLine = () => t("athkar.session.done", { type: t("athkar.morning") });
const close = () => screen.getByRole("button", { name: t("a11y.athkar.focus.close") });
const audio = (label: string) => screen.getByRole("button", { name: t(label) });
const surface = () => screen.queryByTestId(FOCUS_STAGE_PART.SURFACE);
const perform = (actionName: string) =>
  act(() => {
    fireEvent(screen.getByTestId(FOCUS_STAGE_PART.SURFACE), "accessibilityAction", {
      nativeEvent: { actionName },
    });
  });

beforeAll(() => useAppStore.setState({ locale: AppLocale.EN }));

beforeEach(() => {
  jest.clearAllMocks();
  mockInitialize.mockImplementation(async () => {});
  useAthkarAudioStore.setState({ onboardingCompleted: true });
  seed();
});

describe("AthkarFocusScreen", () => {
  it("leaves the sky no sun or moon, whatever the look", async () => {
    useAthkarStore.setState((state) => ({ settings: { ...state.settings, look: TEST_LOOK_ID } }));
    await renderFocus();
    const drawn = { includeHiddenElements: true };
    expect(screen.getAllByTestId(SKY_PART.CANVAS, drawn)).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.BODIES, drawn)).toHaveLength(0);
    useAthkarStore.setState((state) => ({ settings: { ...state.settings, look: null } }));
  });

  describe("the stored look", () => {
    const store = (look: typeof TEST_LOOK_ID | null) =>
      useAthkarStore.setState((state) => ({ settings: { ...state.settings, look } }));
    afterEach(() => store(null));

    it("draws the look a person chose", async () => {
      store(TEST_LOOK_ID);
      await renderFocus();

      expect(screen.getByTestId(TEST_LOOK_PART.FOCUS)).toBeOnTheScreen();
    });

    it("sits on that look's ground while the session is ready", async () => {
      store(TEST_LOOK_ID);
      await renderFocus();
      expect(
        within(screen.getByTestId(TEST_LOOK_PART.GROUND)).getByTestId(TEST_LOOK_PART.FOCUS)
      ).toBeOnTheScreen();
    });

    it("keeps the ground while the day loads", async () => {
      mockInitialize.mockImplementation(() => new Promise(() => {}));
      seed({ loaded: false });
      store(TEST_LOOK_ID);
      await renderFocus();
      expect(
        within(screen.getByTestId(TEST_LOOK_PART.GROUND)).getByTestId(
          ATHKAR_FOCUS_SCREEN_PART.LOADING
        )
      ).toBeOnTheScreen();
    });

    it("keeps the ground under a finished session", async () => {
      seed({ counts: allDone });
      store(TEST_LOOK_ID);
      await renderFocus();
      expect(
        within(screen.getByTestId(TEST_LOOK_PART.GROUND)).getByTestId(SESSION_DONE_ID)
      ).toBeOnTheScreen();
    });
  });

  it("shows the current dhikr with one close control and one audio control", async () => {
    await renderFocus();

    expect(screen.getByText(textOf(1))).toBeOnTheScreen();
    // Reading order: the two controls, then the surface.
    expect(screen.getAllByRole("button")).toEqual([
      audio("a11y.athkar.startAudioSession"),
      close(),
      surface(),
    ]);
  });

  it("opens on the place the reader left, a finished dhikr included", async () => {
    seed({ counts: { [list[0].id]: list[0].count } });
    await renderFocus();
    expect(screen.getByText(textOf(1))).toBeOnTheScreen();
    expect(useAthkarStore.getState().currentAthkarIndex).toBe(0);
  });

  it("goes back from the close control", async () => {
    await renderFocus();
    await userEvent.press(close());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("loads the day, and holds a quiet state with a way out meanwhile", async () => {
    mockInitialize.mockImplementation(() => new Promise(() => {}));
    seed({ loaded: false });
    await renderFocus();

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    const loading = screen.getByTestId(ATHKAR_FOCUS_SCREEN_PART.LOADING);
    expect(loading).toHaveAccessibleName(t("athkar.loading.initializing"));
    expect(loading).not.toBeBusy();
    expect(surface()).toBeNull();
    expect(close()).toBeOnTheScreen();
  });

  it("offers a retry when the day does not load", async () => {
    seed({ loaded: false });
    await renderFocus();

    await userEvent.press(await screen.findByRole("button", { name: t("common.retry") }));
    expect(mockInitialize).toHaveBeenCalledTimes(2);
    expect(close()).toBeOnTheScreen();
  });

  it("counts a repeat on the surface's activation", async () => {
    await renderFocus();
    await perform(A11Y_ACTION.ACTIVATE);
    expect(useAthkarStore.getState().currentProgress[0].currentCount).toBe(1);
  });

  it("marks the hint seen at the first touch", async () => {
    await renderFocus();
    expect(useAthkarStore.getState().focusHintSeen).toBe(false);
    await act(() => createGestureController(FOCUS_GESTURE_ID).begin(STILL));
    expect(useAthkarStore.getState().focusHintSeen).toBe(true);
  });

  describe("a step", () => {
    it("moves the session's place by hand", async () => {
      await renderFocus();
      await perform(FOCUS_ACTION.NEXT);
      expect(useAthkarStore.getState().currentAthkarIndex).toBe(1);
      expect(mockPlayer.jumpTo).not.toHaveBeenCalled();
    });

    it("moves the player one dhikr while audio plays", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING, currentAthkarIndex: 1 });
      await renderFocus();

      await perform(FOCUS_ACTION.NEXT);
      await perform(FOCUS_ACTION.PREVIOUS);
      expect(mockPlayer.jumpTo.mock.calls).toEqual([[list[2].id], [list[0].id]]);
      expect(useAthkarStore.getState().currentAthkarIndex).toBe(1);
    });

    it("moves by hand while audio is between two dhikr or still loading", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.LOADING });
      await renderFocus();
      await perform(FOCUS_ACTION.NEXT);
      expect(useAthkarStore.getState().currentAthkarIndex).toBe(1);
      expect(mockPlayer.jumpTo).not.toHaveBeenCalled();
    });

    it("moves by hand on paused audio, which stays paused", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.PAUSED });
      await renderFocus();
      await perform(FOCUS_ACTION.NEXT);
      expect(useAthkarStore.getState().currentAthkarIndex).toBe(1);
      expect(mockPlayer.jumpTo).not.toHaveBeenCalled();
    });
  });

  describe("audio", () => {
    it("starts the audio session on the current dhikr", async () => {
      await renderFocus();
      await userEvent.press(audio("a11y.athkar.startAudioSession"));
      expect(mockPlayer.startAndJumpTo).toHaveBeenCalledWith(list[0].id);
    });

    it("sets audio up first for a person who has not chosen a reciter", async () => {
      useAthkarAudioStore.setState({ onboardingCompleted: false });
      await renderFocus();
      await userEvent.press(audio("a11y.athkar.startAudioSession"));
      expect(screen.getByText(ONBOARDING)).toBeOnTheScreen();
      expect(mockPlayer.startAndJumpTo).not.toHaveBeenCalled();
    });

    it("pauses a playing session", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING, currentAthkarId: list[0].id });
      await renderFocus();
      await userEvent.press(audio("a11y.athkar.audioPause"));
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });

    it("resumes a paused session where it stopped", async () => {
      useAthkarStore.setState({ playerState: PLAYER_STATE.PAUSED, currentAthkarId: list[0].id });
      await renderFocus();
      await userEvent.press(audio("a11y.athkar.startAudioSession"));
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockPlayer.startAndJumpTo).not.toHaveBeenCalled();
    });
  });

  describe("a finished session", () => {
    it("ends on the reader's finished card, with the close control only", async () => {
      seed({ counts: allDone });
      await renderFocus();

      expect(screen.getByTestId(SESSION_DONE_ID)).toBeOnTheScreen();
      expect(
        screen.getByText(t("athkar.session.done", { type: t("athkar.morning") }))
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toEqual([close()]);
      expect(screen.queryByText(CELEBRATION, hidden)).toBeNull();
    });

    it("says a session that ends here", async () => {
      await renderFocus();
      await act(async () => {
        seed({ counts: allDone });
      });
      expect(announce).toHaveBeenCalledWith(doneLine());
    });

    it("leaves one opened finished to the reader's focus", async () => {
      seed({ counts: allDone });
      await renderFocus();
      expect(announce).not.toHaveBeenCalledWith(doneLine());
    });

    it("stops audio that is still running", async () => {
      seed({ counts: allDone });
      useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING });
      await renderFocus();
      expect(mockPlayer.stop).toHaveBeenCalledTimes(1);
    });

    it("leaves a stopped player alone", async () => {
      seed({ counts: allDone });
      await renderFocus();
      expect(mockPlayer.stop).not.toHaveBeenCalled();
    });
  });
});
