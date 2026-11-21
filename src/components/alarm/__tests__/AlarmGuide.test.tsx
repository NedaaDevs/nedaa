import { screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import AlarmGuide from "@/components/alarm/AlarmGuide";
import { ALARM_GUIDE_CARDS } from "@/constants/AlarmGuide";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);

// Values no shipped build has, so text typed into a locale string cannot match.
jest.mock("@/constants/WakeTaskShell", () => ({
  ...jest.requireActual("@/constants/WakeTaskShell"),
  QUIET_TIME_SECONDS: { DEFAULT: 45, SCREEN_READER: 90 },
  WAY_OUT_SOUNDING_SECONDS: 180,
}));
jest.mock("@/constants/WakeTask", () => ({
  ...jest.requireActual("@/constants/WakeTask"),
  WAKE_TASK_MAX_STACK: 4,
}));

const mockScreenReader = jest.fn(() => false);
jest.mock("@/hooks/useScreenReader", () => ({ useScreenReader: () => mockScreenReader() }));

// Each arrow draws a marker, so a test can tell which way it points.
jest.mock("lucide-react-native", () => {
  const { View } = jest.requireActual("react-native");
  const arrow = (testID: string) => {
    const Arrow = () => <View testID={testID} />;
    Arrow.displayName = testID;
    return Arrow;
  };
  return {
    ...jest.requireActual("lucide-react-native"),
    ChevronLeft: arrow("arrow-left"),
    ChevronRight: arrow("arrow-right"),
  };
});

const TOTAL = ALARM_GUIDE_CARDS.length;
const GUIDE_KEY = /^(a11y\.)?alarm\.guide\./;

type Options = { isRTL?: boolean; onTryTask?: () => void };

const renderGuide = async ({ isRTL = false, onTryTask }: Options = {}) => {
  const onClose = jest.fn();
  await renderWithTheme(<AlarmGuide open onClose={onClose} onTryTask={onTryTask} />, { isRTL });
  return { onClose, user: userEvent.setup() };
};

const heading = () => screen.getByRole("header");
const press = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.press(screen.getByRole("button", { name }));

const toCard = async (user: ReturnType<typeof userEvent.setup>, at: number) => {
  for (let step = 1; step < at; step += 1) await press(user, "Next");
};

beforeAll(() => usePreferencesStore.setState({ useWesternNumerals: true }));

beforeEach(() => mockScreenReader.mockReturnValue(false));

describe("the alarm guide", () => {
  it("opens on the first card, with Skip and no Back", async () => {
    await renderGuide();

    expect(heading()).toHaveAccessibleName(`Card 1 of ${TOTAL}. The alarm`);
    expect(screen.getByRole("button", { name: "Skip" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("closes from the first card on Skip", async () => {
    const { onClose, user } = await renderGuide();

    await press(user, "Skip");

    expect(onClose).toHaveBeenCalled();
  });

  it("goes forward one card on Next and back one on Back", async () => {
    const { user } = await renderGuide();

    await press(user, "Next");
    expect(heading()).toHaveAccessibleName(`Card 2 of ${TOTAL}. Wake-up task`);

    await press(user, "Back");
    expect(heading()).toHaveAccessibleName(`Card 1 of ${TOTAL}. The alarm`);
  });

  it("speaks each new card's place once, from its heading", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const { user } = await renderGuide();
    focus.mockClear();

    await press(user, "Next");

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), "focus");
    focus.mockRestore();
  });

  it("shows the place without saying it twice", async () => {
    await renderGuide();

    expect(screen.queryByText(`1 of ${TOTAL}`)).toBeNull();
    expect(screen.getByText(`1 of ${TOTAL}`, { includeHiddenElements: true })).toBeTruthy();
  });

  it("ends on Done, without Next or Skip", async () => {
    const { onClose, user } = await renderGuide();
    await toCard(user, TOTAL);

    expect(heading()).toHaveAccessibleName(`Card ${TOTAL} of ${TOTAL}. Stopping without the task`);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

    await press(user, "Done");
    expect(onClose).toHaveBeenCalled();
  });

  it("offers a task to try on the last card only where there is one", async () => {
    const onTryTask = jest.fn();
    const { user } = await renderGuide({ onTryTask });
    await toCard(user, TOTAL);

    await press(user, "Try a task");

    expect(onTryTask).toHaveBeenCalled();
  });

  it("has no task to try without a picker", async () => {
    const { user } = await renderGuide();
    await toCard(user, TOTAL);

    expect(screen.queryByRole("button", { name: "Try a task" })).toBeNull();
  });

  it.each([
    [false, "arrow-left", "arrow-right"],
    [true, "arrow-right", "arrow-left"],
  ])("points Back to the start edge and Next to the end (RTL %s)", async (isRTL, back, next) => {
    const { user } = await renderGuide({ isRTL });
    await press(user, "Next");

    const backButton = screen.getByRole("button", { name: "Back" });
    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(screen.getByTestId(back)).toBeOnTheScreen();
    expect(backButton).toContainElement(screen.getByTestId(back));
    expect(nextButton).toContainElement(screen.getByTestId(next));
  });
});

describe("the guide's numbers", () => {
  it("states the quiet time the task shell uses", async () => {
    const { user } = await renderGuide();
    await press(user, "Next");

    expect(
      screen.getByText(
        "The sound pauses for 45 seconds when the task first starts, and again after each step."
      )
    ).toBeOnTheScreen();
  });

  it("states the longer quiet time with a screen reader on", async () => {
    mockScreenReader.mockReturnValue(true);
    const { user } = await renderGuide();
    await press(user, "Next");

    expect(screen.getByText(/pauses for 90 seconds/)).toBeOnTheScreen();
  });

  it("states the most tasks an alarm can take", async () => {
    const { user } = await renderGuide();
    await toCard(user, 3);

    expect(
      screen.getByText("An alarm can have up to 4 tasks, done one after another.")
    ).toBeOnTheScreen();
  });

  it("states the sounding time before the way out", async () => {
    const { user } = await renderGuide();
    await toCard(user, TOTAL);

    expect(screen.getByText('After 3 minutes, a "Stop alarm" button appears.')).toBeOnTheScreen();
  });

  it.each([
    ["en", en],
    ["ar", ar],
  ])("types no number into a guide string in %s", (_, locale) => {
    const guide = Object.entries(locale).filter(([key]) => GUIDE_KEY.test(key));

    expect(guide.length).toBeGreaterThan(0);
    expect(guide.filter(([, value]) => /\d/.test(String(value)))).toEqual([]);
  });

  it("writes the Arabic numbers in the reader's digits", async () => {
    usePreferencesStore.setState({ useWesternNumerals: false });
    useAppStore.setState({ locale: AppLocale.AR });
    await i18n.changeLanguage(AppLocale.AR);
    try {
      const { user } = await renderGuide({ isRTL: true });
      await press(user, "التالي");

      expect(screen.getByText(/٤٥ ثانية/)).toBeOnTheScreen();
    } finally {
      await i18n.changeLanguage(AppLocale.EN);
      useAppStore.setState({ locale: AppLocale.EN });
      usePreferencesStore.setState({ useWesternNumerals: true });
    }
  });
});
