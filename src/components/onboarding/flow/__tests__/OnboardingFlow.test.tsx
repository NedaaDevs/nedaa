import { AccessibilityInfo, BackHandler } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import { CompleteStep } from "@/components/onboarding/flow/steps/CompleteStep";
import { enterOffset } from "@/components/onboarding/flow/StepTransition";
import {
  ONBOARDING_LOADING_DELAY_MS,
  ONBOARDING_PART,
  ONBOARDING_STEP as S,
  STEP_DIRECTION,
  STEP_LOCK_MS,
  STEP_MOTION,
  type OnboardingStepId,
} from "@/constants/Onboarding";
import { RTLProvider } from "@/contexts/RTLContext";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { controlProblems } from "@/test-helpers/controls";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { clearHaptics, firedHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import {
  currentStep,
  propsOf,
  realSteps,
  resetStepStubs,
} from "@/test-helpers/onboardingStepStubs";
import { renderWithTheme } from "@/test-helpers/theme";

// The transition's starting values show as the shared values it creates.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("@/test-helpers/reanimatedMock");
  return { __esModule: true, ...actual, useSharedValue: jest.fn(actual.useSharedValue) };
});
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
let mockReduced = false;
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const STUB_PRIMARY = "stub primary";
let mockSkyMounts = 0;
let mockColumn: OnboardingStepId[] | null = null;
let mockLoadingRenders = 0;

jest.mock("@/components/onboarding/flow/OnboardingLoading", () => {
  const { createElement: h } = jest.requireActual("react");
  const { OnboardingLoading } = jest.requireActual(
    "@/components/onboarding/flow/OnboardingLoading"
  );
  const CountedLoading = () => {
    mockLoadingRenders += 1;
    return h(OnboardingLoading);
  };
  return { OnboardingLoading: CountedLoading };
});

jest.mock("@/components/ui/sky-background", () => {
  const { createElement: h, Fragment, useEffect } = jest.requireActual("react");
  const SkyBackgroundStub = ({ children }: { children?: unknown }) => {
    useEffect(() => {
      mockSkyMounts += 1;
    }, []);
    return h(Fragment, null, children);
  };
  return {
    ...jest.requireActual("@/components/ui/sky-background"),
    SkyBackground: SkyBackgroundStub,
  };
});
jest.mock("@/components/onboarding/flow/useOnboardingColumn", () => ({
  ...jest.requireActual("@/components/onboarding/flow/useOnboardingColumn"),
  useOnboardingColumn: () => mockColumn,
}));
jest.mock("@/components/onboarding/flow/steps", () =>
  jest.requireActual("@/test-helpers/onboardingStepStubs")
);

const t = i18n.t.bind(i18n);
let mockNow = 0;
/** Lets the step-change lock expire, as a slow second tap would. */
const afterTheLock = () => {
  mockNow += STEP_LOCK_MS;
};
const press = async (testID: string) => {
  await userEvent.press(screen.getByTestId(testID));
  afterTheLock();
};
/** Welcome draws no frame controls; its own button calls onNext. */
const leaveWelcome = async () => {
  await act(async () => propsOf(S.WELCOME).onNext());
  afterTheLock();
};
const progressText = () =>
  screen.getByTestId(ONBOARDING_PART.PROGRESS, { includeHiddenElements: true });
/** The entry a newly mounted step plays, over the move's duration. */
const expectEntry = (ms: number) =>
  expect(withTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: ms }));
/** VoiceOver's escape gesture on the frame. */
const escape = () =>
  act(async () => {
    // userEvent has no accessibility actions, so the escape gesture is fired.
    fireEvent(
      screen.getByTestId(ONBOARDING_PART.FRAME, { includeHiddenElements: true }),
      "accessibilityEscape"
    );
  });
const BAR_PARTS = [
  ONBOARDING_PART.SKIP,
  ONBOARDING_PART.BACK,
  ONBOARDING_PART.CONTINUE,
  ONBOARDING_PART.PROGRESS,
  ONBOARDING_PART.PROGRESS_FILL,
];
/** Neither bar is drawn: no brand, skip, back, continue or progress. */
const expectBareFrame = () => {
  for (const id of BAR_PARTS) {
    expect(screen.queryByTestId(id, { includeHiddenElements: true })).toBeNull();
  }
  expect(screen.queryByText(t("brand.name"))).toBeNull();
};
const realSetIsFirstRun = useAppStore.getState().setIsFirstRun;
/** Captures the flow's Android back handler; the press returns its answer. */
const hardwareBack = () => {
  const handlers: (() => boolean | null | undefined)[] = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
    handlers.push(handler as () => boolean | null | undefined);
    return { remove: () => {} };
  });
  return async () => {
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = handlers.at(-1)?.();
    });
    return handled;
  };
};

describe("OnboardingFlow", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ isFirstRun: true, onboardingStep: null, locale: AppLocale.EN });
    mockColumn = [S.WELCOME, S.NUMERALS, S.APPEARANCE, S.COMPLETE];
    mockSkyMounts = 0;
    mockReduced = false;
    mockLoadingRenders = 0;
    clearHaptics();
    mockNow = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => mockNow);
    resetStepStubs();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    // The flow is still mounted here and reads this action.
    await act(async () => useAppStore.setState({ setIsFirstRun: realSetIsFirstRun }));
  });

  describe("while the column is read", () => {
    /** The column still unread when the loading delay ends. */
    const pastTheDelay = () =>
      act(() => jest.advanceTimersByTimeAsync(ONBOARDING_LOADING_DELAY_MS));

    beforeEach(() => {
      // Date stays real: the step lock reads the spied Date.now.
      jest.useFakeTimers({ doNotFake: ["Date"] });
      mockColumn = null;
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows the bare sky, not the loading state, before the delay", async () => {
      await renderWithTheme(<OnboardingFlow />);
      await act(() => jest.advanceTimersByTimeAsync(ONBOARDING_LOADING_DELAY_MS - 1));

      expect(screen.queryByTestId(ONBOARDING_PART.LOADING)).toBeNull();
      expect(screen.queryByTestId(ONBOARDING_PART.CONTINUE)).toBeNull();
      expect(mockLoadingRenders).toBe(0);
      expect(mockSkyMounts).toBe(1);
    });

    it("never draws the loading state for a column read before the delay", async () => {
      const view = await renderWithTheme(<OnboardingFlow />);
      await act(() => jest.advanceTimersByTimeAsync(ONBOARDING_LOADING_DELAY_MS - 1));

      mockColumn = [S.WELCOME, S.NUMERALS, S.COMPLETE];
      await view.rerender(<OnboardingFlow />);
      await act(() => jest.advanceTimersByTimeAsync(ONBOARDING_LOADING_DELAY_MS * 2));

      expect(currentStep()).toBe(S.WELCOME);
      expect(mockLoadingRenders).toBe(0);
    });

    it("shows the loading state over the sky once the delay passes", async () => {
      await renderWithTheme(<OnboardingFlow />);
      await pastTheDelay();

      expect(screen.getByTestId(ONBOARDING_PART.LOADING)).toHaveAccessibleName(
        t("onboarding.loading")
      );
      expect(screen.getByTestId(ONBOARDING_PART.LOADING_SPINNER)).toBeTruthy();
      expect(screen.queryByTestId(ONBOARDING_PART.CONTINUE)).toBeNull();
      expect(mockSkyMounts).toBe(1);
    });

    it("speaks the loading state as one element", async () => {
      await renderWithTheme(<OnboardingFlow />);
      await pastTheDelay();

      expect(screen.getAllByLabelText(t("onboarding.loading"))).toHaveLength(1);
      expect(screen.getByRole("progressbar")).toHaveAccessibleName(t("onboarding.loading"));
    });

    it("keeps the loading icon still under Reduce Motion", async () => {
      mockReduced = true;
      await renderWithTheme(<OnboardingFlow />);
      await pastTheDelay();

      expect(screen.getByTestId(ONBOARDING_PART.LOADING)).toBeTruthy();
      expect(screen.queryByTestId(ONBOARDING_PART.LOADING_SPINNER)).toBeNull();
    });

    it("replaces a shown loading state with the first step on the same sky", async () => {
      const view = await renderWithTheme(<OnboardingFlow />);
      await pastTheDelay();
      expect(screen.getByTestId(ONBOARDING_PART.LOADING)).toBeTruthy();

      mockColumn = [S.WELCOME, S.NUMERALS, S.COMPLETE];
      await view.rerender(<OnboardingFlow />);

      expect(screen.queryByTestId(ONBOARDING_PART.LOADING)).toBeNull();
      expect(currentStep()).toBe(S.WELCOME);
      expect(mockSkyMounts).toBe(1);
    });
  });

  it("advances and goes back one step at a time", async () => {
    await renderWithTheme(<OnboardingFlow />);

    await leaveWelcome();
    expect(currentStep()).toBe(S.NUMERALS);
    await press(ONBOARDING_PART.BACK);
    expect(currentStep()).toBe(S.WELCOME);
  });

  // The step-change lock absorbs a second tap that lands during the move.
  it("moves once for a double tap, and again after the step settles", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    expect(currentStep()).toBe(S.APPEARANCE);

    afterTheLock();
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    expect(currentStep()).toBe(S.COMPLETE);
  });

  it("saves the furthest step and never lowers it on back", async () => {
    await renderWithTheme(<OnboardingFlow />);
    await leaveWelcome();
    await press(ONBOARDING_PART.CONTINUE);
    expect(useAppStore.getState().onboardingStep).toBe(S.APPEARANCE);

    await press(ONBOARDING_PART.BACK);

    expect(currentStep()).toBe(S.NUMERALS);
    expect(useAppStore.getState().onboardingStep).toBe(S.APPEARANCE);
  });

  it("resumes at the saved step", async () => {
    useAppStore.setState({ onboardingStep: S.APPEARANCE });
    await renderWithTheme(<OnboardingFlow />);

    expect(currentStep()).toBe(S.APPEARANCE);
  });

  it("holds back and skip while the step is busy, but not the step's own onNext", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);
    await act(async () => propsOf(S.NUMERALS).setBusy(true));

    await press(ONBOARDING_PART.BACK);
    await press(ONBOARDING_PART.SKIP);
    expect(currentStep()).toBe(S.NUMERALS);

    await act(async () => propsOf(S.NUMERALS).onNext());
    expect(currentStep()).toBe(S.APPEARANCE);
  });

  it("Android back moves back, is held while busy, and leaves on the first step", async () => {
    const backPress = hardwareBack();
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);

    await act(async () => propsOf(S.NUMERALS).setBusy(true));
    expect(await backPress()).toBe(true);
    afterTheLock();
    expect(currentStep()).toBe(S.NUMERALS);

    await act(async () => propsOf(S.NUMERALS).setBusy(false));
    expect(await backPress()).toBe(true);
    afterTheLock();
    expect(currentStep()).toBe(S.WELCOME);
    expect(await backPress()).toBe(false);
  });

  // A recompute that drops the shown step carries none of its state forward.
  it("a removed current step resolves forward and leaves its primary and busy behind", async () => {
    mockColumn = [S.WELCOME, S.NOTIFICATIONS, S.FAJR_ALARM, S.COMPLETE];
    useAppStore.setState({ onboardingStep: S.NOTIFICATIONS });
    const view = await renderWithTheme(<OnboardingFlow />);
    const onPress = jest.fn();
    await act(async () => {
      propsOf(S.NOTIFICATIONS).setPrimary({ label: STUB_PRIMARY, onPress });
      propsOf(S.NOTIFICATIONS).setBusy(true);
    });
    expect(screen.getByRole("button", { name: STUB_PRIMARY })).toBeTruthy();

    mockColumn = [S.WELCOME, S.FAJR_ALARM, S.COMPLETE];
    await view.rerender(<OnboardingFlow />);

    expect(currentStep()).toBe(S.FAJR_ALARM);
    expect(screen.getByRole("button", { name: t("onboarding.continue") })).toBeTruthy();
    afterTheLock();
    await press(ONBOARDING_PART.BACK);
    expect(currentStep()).toBe(S.WELCOME);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("lets a step's own primary replace Continue", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);
    const onPress = jest.fn();
    await act(async () => propsOf(S.NUMERALS).setPrimary({ label: STUB_PRIMARY, onPress }));

    await press(ONBOARDING_PART.CONTINUE);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(currentStep()).toBe(S.NUMERALS);
  });

  it("hides Continue for the step that asked, keeps Back, and shows it again on a step change", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);

    await act(async () => propsOf(S.NUMERALS).setPrimaryHidden(true));
    expect(screen.queryByTestId(ONBOARDING_PART.CONTINUE)).toBeNull();
    expect(screen.getByTestId(ONBOARDING_PART.BACK)).toBeOnTheScreen();

    await press(ONBOARDING_PART.SKIP);
    expect(currentStep()).toBe(S.APPEARANCE);
    expect(screen.getByTestId(ONBOARDING_PART.CONTINUE)).toBeOnTheScreen();

    await press(ONBOARDING_PART.BACK);
    expect(currentStep()).toBe(S.NUMERALS);
    expect(screen.getByTestId(ONBOARDING_PART.CONTINUE)).toBeOnTheScreen();
  });

  it("holds a step's own skip while busy and during the step lock, so a double tap moves once", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);

    await act(async () => propsOf(S.NUMERALS).onSkip());
    expect(currentStep()).toBe(S.APPEARANCE);
    await act(async () => propsOf(S.APPEARANCE).onSkip());
    expect(currentStep()).toBe(S.APPEARANCE);

    afterTheLock();
    await act(async () => propsOf(S.APPEARANCE).setBusy(true));
    await act(async () => propsOf(S.APPEARANCE).onSkip());
    expect(currentStep()).toBe(S.APPEARANCE);

    await act(async () => propsOf(S.APPEARANCE).setBusy(false));
    await act(async () => propsOf(S.APPEARANCE).onSkip());
    expect(currentStep()).toBe(S.COMPLETE);
  });

  it("skips on, and offers no skip on the last step", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);
    await press(ONBOARDING_PART.SKIP);
    expect(currentStep()).toBe(S.APPEARANCE);

    await press(ONBOARDING_PART.SKIP);
    expect(currentStep()).toBe(S.COMPLETE);
    expect(screen.queryByTestId(ONBOARDING_PART.SKIP)).toBeNull();
  });

  it("ends the first run from the last step's own button", async () => {
    useAppStore.setState({ onboardingStep: S.COMPLETE });
    await renderWithTheme(<OnboardingFlow />);

    await act(async () => propsOf(S.COMPLETE).onNext());

    expect(useAppStore.getState().isFirstRun).toBe(false);
  });

  it("ignores Completion's button during the step lock, then ends the first run once", async () => {
    const end = jest.fn(realSetIsFirstRun);
    useAppStore.setState({ onboardingStep: S.APPEARANCE, setIsFirstRun: end });
    await renderWithTheme(<OnboardingFlow />);
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    expect(currentStep()).toBe(S.COMPLETE);

    await act(async () => propsOf(S.COMPLETE).onNext());
    expect(end).not.toHaveBeenCalled();

    afterTheLock();
    await act(async () => {
      propsOf(S.COMPLETE).onNext();
      propsOf(S.COMPLETE).onNext();
    });
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith(false);
  });

  it("taps light on a step change, and plays only the success haptic on arrival at Completion", async () => {
    realSteps.set(S.COMPLETE, CompleteStep);
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);

    await press(ONBOARDING_PART.CONTINUE);
    expect(currentStep()).toBe(S.APPEARANCE);
    expect(HAPTIC[HAPTIC_FEEDBACK.LIGHT]).toHaveBeenCalledTimes(1);

    clearHaptics();
    await press(ONBOARDING_PART.CONTINUE);
    expect(currentStep()).toBe(S.COMPLETE);
    expect(HAPTIC[HAPTIC_FEEDBACK.SUCCESS]).toHaveBeenCalledTimes(1);
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.SUCCESS]);
  });

  it("lets Android back through while it is leaving", async () => {
    const backPress = hardwareBack();
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow leaving />);

    expect(await backPress()).toBe(false);
    expect(currentStep()).toBe(S.NUMERALS);
  });

  describe("a step's own back", () => {
    it("takes the frame's Back, Android back and the escape gesture while it is set", async () => {
      const backPress = hardwareBack();
      useAppStore.setState({ onboardingStep: S.NUMERALS });
      await renderWithTheme(<OnboardingFlow />);
      const toParent = jest.fn();
      await act(async () => propsOf(S.NUMERALS).setBack(toParent));

      await press(ONBOARDING_PART.BACK);
      expect(await backPress()).toBe(true);
      await escape();

      expect(toParent).toHaveBeenCalledTimes(3);
      expect(currentStep()).toBe(S.NUMERALS);
    });

    it("gives every back to the flow once it is cleared", async () => {
      const backPress = hardwareBack();
      useAppStore.setState({ onboardingStep: S.APPEARANCE });
      await renderWithTheme(<OnboardingFlow />);
      const toParent = jest.fn();
      await act(async () => propsOf(S.APPEARANCE).setBack(toParent));
      await act(async () => propsOf(S.APPEARANCE).setBack(null));

      await press(ONBOARDING_PART.BACK);
      expect(currentStep()).toBe(S.NUMERALS);
      expect(await backPress()).toBe(true);
      afterTheLock();
      expect(currentStep()).toBe(S.WELCOME);
      expect(toParent).not.toHaveBeenCalled();
    });

    it("is dropped on a step change", async () => {
      useAppStore.setState({ onboardingStep: S.NUMERALS });
      await renderWithTheme(<OnboardingFlow />);
      const toParent = jest.fn();
      await act(async () => propsOf(S.NUMERALS).setBack(toParent));

      await press(ONBOARDING_PART.SKIP);
      await press(ONBOARDING_PART.BACK);
      expect(currentStep()).toBe(S.NUMERALS);
      // Back on the step that set it reaches a claim only if never dropped.
      await press(ONBOARDING_PART.BACK);

      expect(currentStep()).toBe(S.WELCOME);
      expect(toParent).not.toHaveBeenCalled();
    });
  });

  describe("the frame around a counted step", () => {
    it("gives every control a role, a name and a 44pt target", async () => {
      useAppStore.setState({ onboardingStep: S.NUMERALS });
      await renderWithTheme(<OnboardingFlow />);

      expect(screen.getByTestId(ONBOARDING_PART.CONTINUE)).toBeOnTheScreen();
      expect(controlProblems()).toEqual([]);
    });

    it("moves back on VoiceOver's escape gesture", async () => {
      useAppStore.setState({ onboardingStep: S.NUMERALS });
      await renderWithTheme(<OnboardingFlow />);

      await escape();

      expect(currentStep()).toBe(S.WELCOME);
    });

    it("draws the count with digits of one width", async () => {
      useAppStore.setState({ onboardingStep: S.NUMERALS });
      await renderWithTheme(<OnboardingFlow />);

      expect(progressText()).toHaveStyle({ fontVariant: ["tabular-nums"] });
    });
  });

  // A late onNext from a step already left must not move the user.
  it("ignores a request from a step the user has left", async () => {
    useAppStore.setState({ onboardingStep: S.NUMERALS });
    await renderWithTheme(<OnboardingFlow />);
    const left = propsOf(S.NUMERALS);

    await press(ONBOARDING_PART.SKIP);
    await press(ONBOARDING_PART.CONTINUE);
    expect(currentStep()).toBe(S.COMPLETE);
    await act(async () => left.onNext());

    expect(currentStep()).toBe(S.COMPLETE);
  });

  describe("a fetch that has stored the day", () => {
    it("is passed going forward, as it is going back", async () => {
      mockColumn = [S.WELCOME, S.LOCATION, S.FETCH, S.CALCULATION, S.NOTIFICATIONS, S.COMPLETE];
      useAppStore.setState({ onboardingStep: S.LOCATION });
      await renderWithTheme(<OnboardingFlow />);

      await press(ONBOARDING_PART.CONTINUE);

      expect(currentStep()).toBe(S.CALCULATION);
    });

    it("still runs going forward while no day is stored", async () => {
      mockColumn = [S.WELCOME, S.LOCATION, S.FETCH, S.NOTIFICATIONS, S.COMPLETE];
      useAppStore.setState({ onboardingStep: S.LOCATION });
      await renderWithTheme(<OnboardingFlow />);

      await press(ONBOARDING_PART.CONTINUE);

      expect(currentStep()).toBe(S.FETCH);
    });
  });

  // The step's number never repeats on a forward move, as steps leave and join.
  it("keeps the number of a step that left the column", async () => {
    mockColumn = [
      S.WELCOME,
      S.NUMERALS,
      S.LOCATION,
      S.LOCATION_PERMISSION,
      S.NOTIFICATIONS,
      S.COMPLETE,
    ];
    useAppStore.setState({ onboardingStep: S.LOCATION });
    const view = await renderWithTheme(<OnboardingFlow />);
    const place = (current: number, total: number) => t("onboarding.progress", { current, total });
    expect(propsOf(S.LOCATION).progress).toBe(place(2, 4));

    await press(ONBOARDING_PART.CONTINUE);
    expect(propsOf(S.LOCATION_PERMISSION).progress).toBe(place(3, 4));

    // The grant takes the prime out of the column and brings the fetch in.
    mockColumn = [S.WELCOME, S.NUMERALS, S.LOCATION, S.FETCH, S.NOTIFICATIONS, S.COMPLETE];
    await view.rerender(<OnboardingFlow />);

    expect(currentStep()).toBe(S.FETCH);
    expect(propsOf(S.FETCH).progress).toBe(place(4, 5));
  });

  describe("the direction of a move", () => {
    const { FORWARD, BACK } = STEP_DIRECTION;

    it("comes from the order: a column move forward after a Back plays forward", async () => {
      mockColumn = [S.WELCOME, S.NUMERALS, S.APPEARANCE, S.NOTIFICATIONS, S.COMPLETE];
      useAppStore.setState({ onboardingStep: S.NOTIFICATIONS });
      const view = await renderWithTheme(<OnboardingFlow />);
      await press(ONBOARDING_PART.BACK);
      expect(currentStep()).toBe(S.APPEARANCE);
      jest.mocked(useSharedValue).mockClear();

      jest.mocked(withTiming).mockClear();
      mockColumn = [S.WELCOME, S.NUMERALS, S.NOTIFICATIONS, S.COMPLETE];
      await view.rerender(<OnboardingFlow />);

      expect(currentStep()).toBe(S.NOTIFICATIONS);
      expect(useSharedValue).toHaveBeenCalledWith(enterOffset(FORWARD, false));
      expect(useSharedValue).not.toHaveBeenCalledWith(enterOffset(BACK, false));
      expectEntry(STEP_MOTION.FORWARD_MS);
    });

    it("plays back for a Back, and forward for Continue", async () => {
      useAppStore.setState({ onboardingStep: S.APPEARANCE });
      await renderWithTheme(<OnboardingFlow />);

      jest.mocked(useSharedValue).mockClear();
      jest.mocked(withTiming).mockClear();
      await press(ONBOARDING_PART.BACK);
      expect(useSharedValue).toHaveBeenCalledWith(enterOffset(BACK, false));
      expectEntry(STEP_MOTION.BACK_MS);

      jest.mocked(useSharedValue).mockClear();
      jest.mocked(withTiming).mockClear();
      await press(ONBOARDING_PART.CONTINUE);
      expect(useSharedValue).toHaveBeenCalledWith(enterOffset(FORWARD, false));
      expectEntry(STEP_MOTION.FORWARD_MS);
    });
  });

  describe("Welcome and Completion are bare and uncounted", () => {
    it("draws no brand, skip, back, continue or progress on Welcome", async () => {
      await renderWithTheme(<OnboardingFlow />);

      expect(currentStep()).toBe(S.WELCOME);
      expectBareFrame();
    });

    it("counts the pages between Welcome and Completion; the last before Completion is N of N", async () => {
      await renderWithTheme(<OnboardingFlow />);
      const place = (current: number) => t("onboarding.progress", { current, total: 2 });

      await leaveWelcome();
      expect(progressText()).toHaveTextContent(place(1));
      await press(ONBOARDING_PART.CONTINUE);
      expect(progressText()).toHaveTextContent(place(2));
    });

    it("hands the step the same numbers, and Welcome and Completion none", async () => {
      await renderWithTheme(<OnboardingFlow />);
      expect(propsOf(S.WELCOME).progress).toBe("");

      await leaveWelcome();
      await press(ONBOARDING_PART.CONTINUE);
      await press(ONBOARDING_PART.CONTINUE);

      expect(propsOf(S.NUMERALS).progress).toBe(t("onboarding.progress", { current: 1, total: 2 }));
      expect(propsOf(S.APPEARANCE).progress).toBe(
        t("onboarding.progress", { current: 2, total: 2 })
      );
      expect(propsOf(S.COMPLETE).progress).toBe("");
    });

    it("fills the bar by the counted place", async () => {
      await renderWithTheme(<OnboardingFlow />);

      const fill = () =>
        screen.getByTestId(ONBOARDING_PART.PROGRESS_FILL, { includeHiddenElements: true });

      await leaveWelcome();
      expect(fill()).toHaveStyle({ width: "50%" });
      await press(ONBOARDING_PART.CONTINUE);
      expect(fill()).toHaveStyle({ width: "100%" });
    });

    it("draws no brand, skip, back, continue or progress on Completion", async () => {
      useAppStore.setState({ onboardingStep: S.APPEARANCE });
      await renderWithTheme(<OnboardingFlow />);

      await press(ONBOARDING_PART.CONTINUE);

      expect(currentStep()).toBe(S.COMPLETE);
      expectBareFrame();
    });

    it("brings the frame in after Welcome and takes it away on the way back", async () => {
      await renderWithTheme(<OnboardingFlow />);

      await leaveWelcome();
      expect(screen.getByTestId(ONBOARDING_PART.SKIP)).toBeOnTheScreen();
      expect(screen.getByTestId(ONBOARDING_PART.BACK)).toBeOnTheScreen();
      expect(screen.getByTestId(ONBOARDING_PART.CONTINUE)).toBeOnTheScreen();
      expect(screen.getByText(t("brand.name"))).toBeOnTheScreen();

      await press(ONBOARDING_PART.BACK);

      expect(currentStep()).toBe(S.WELCOME);
      expect(screen.queryByTestId(ONBOARDING_PART.BACK)).toBeNull();
      expect(screen.queryByTestId(ONBOARDING_PART.CONTINUE)).toBeNull();
      expect(screen.queryByTestId(ONBOARDING_PART.SKIP)).toBeNull();
    });

    it("slides the first counted step in from the reading start, inside the frame", async () => {
      await renderWithTheme(<OnboardingFlow />);
      const welcome = screen.getByTestId(ONBOARDING_PART.TRANSITION);
      jest.mocked(useSharedValue).mockClear();
      jest.mocked(withTiming).mockClear();

      await leaveWelcome();

      // A new transition per step: the old one never takes the next step.
      expect(screen.getByTestId(ONBOARDING_PART.TRANSITION)).not.toBe(welcome);
      expect(useSharedValue).toHaveBeenCalledWith(enterOffset(STEP_DIRECTION.FORWARD, false));
      expectEntry(STEP_MOTION.FORWARD_MS);
      expect(screen.getByTestId(ONBOARDING_PART.CONTINUE)).toBeOnTheScreen();
    });
  });

  it("moves reader focus to the new step's heading", async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => {});
    await renderWithTheme(<OnboardingFlow />);
    focus.mockClear();

    await leaveWelcome();

    expect(focus).toHaveBeenCalledWith(propsOf(S.NUMERALS).headingRef.current, "focus");
  });

  // A language change flips the enter side without remounting the sky.
  it("enters the next step from the new reading start after a language change, on one sky", async () => {
    await renderWithTheme(
      <RTLProvider>
        <OnboardingFlow />
      </RTLProvider>
    );
    jest.mocked(withTiming).mockClear();

    await act(async () => useAppStore.setState({ locale: AppLocale.AR }));
    expect(withTiming).not.toHaveBeenCalled();
    jest.mocked(useSharedValue).mockClear();

    await leaveWelcome();
    expect(useSharedValue).toHaveBeenCalledWith(enterOffset(STEP_DIRECTION.FORWARD, true));
    expectEntry(STEP_MOTION.FORWARD_MS);
    expect(mockSkyMounts).toBe(1);
  });
});
