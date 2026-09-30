// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screens must bind to the mock below, not to its empty one.
import AcknowledgementsScreen from "@/app/settings/acknowledgements";
import BackgroundDebugScreen from "@/app/settings/background-debug";
import DiagnosticsDebugScreen from "@/app/settings/diagnostics-debug";
import FeedbackScreen from "@/app/settings/feedback";
import HelpScreen from "@/app/settings/help";
import PrivacyScreen from "@/app/settings/privacy";
import QuranAudioDebugScreen from "@/app/settings/quran-audio-debug";
import WidgetsDebugScreen from "@/app/settings/widgets-debug";
import type { ComponentType } from "react";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { DEBUG_SCREEN, type DebugScreen } from "@/constants/DebugScreens";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
// Debug screens reach native players and the prayer database at import; the header is
// what is tested here.
jest.mock("@/tasks/backgroundRefresh", () => ({ BACKGROUND_REFRESH_TASK: "background-refresh" }));
jest.mock("react-native-nitro-player", () => ({ TrackPlayer: {}, PlayerQueue: {} }));
jest.mock("@/services/quran-audio/quranAudioPlayer", () => ({ quranAudioPlayer: {} }));
jest.mock("@/services/audio/nitroSession", () => ({ nitroSession: {} }));
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => false }));
jest.mock("@/services/feedback", () => ({
  ...jest.requireActual("@/services/feedback"),
  submitFeedback: jest.fn().mockResolvedValue({ id: "report" }),
}));

type Destination = { route: string; href: unknown };

const DEBUG_SCREENS: Record<DebugScreen["route"], ComponentType> = {
  [DEBUG_SCREEN.BACKGROUND.route]: BackgroundDebugScreen,
  [DEBUG_SCREEN.QURAN_AUDIO.route]: QuranAudioDebugScreen,
  [DEBUG_SCREEN.DIAGNOSTICS.route]: DiagnosticsDebugScreen,
  [DEBUG_SCREEN.WIDGETS.route]: WidgetsDebugScreen,
};

const CHILDREN: readonly [Destination, ComponentType][] = [
  [BACK_DESTINATION.SETTINGS_HELP, HelpScreen],
  [BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS, AcknowledgementsScreen],
  [BACK_DESTINATION.SETTINGS_PRIVACY, PrivacyScreen],
  [BACK_DESTINATION.SETTINGS_FEEDBACK, FeedbackScreen],
  ...Object.values(DEBUG_SCREEN).map(
    (entry) => [entry, DEBUG_SCREENS[entry.route]] as [Destination, ComponentType]
  ),
];

const renderCold = ({ route, href }: Destination, Screen: ComponentType) =>
  renderRouter(
    { [route]: () => <Screen /> },
    {
      initialUrl: href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const backToAbout = () =>
  screen.getByRole("button", {
    name: i18n.t("a11y.backTo", { screen: i18n.t("settings.about.title") }),
  });

beforeEach(() => {
  useAppStore.setState({ locale: AppLocale.EN });
});

// Opened cold, as from a link, a screen About lists goes back to About.
describe.each(CHILDREN)("$route opened with nothing behind", (destination, Screen) => {
  it("goes back to About", async () => {
    await renderCold(destination, Screen);

    expect(backToAbout()).toBeTruthy();
  });
});

// The sent state draws its own header, which must lead back to About too.
describe("feedback, once sent", () => {
  it("goes back to About", async () => {
    await renderCold(BACK_DESTINATION.SETTINGS_FEEDBACK, FeedbackScreen);
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(i18n.t("feedback.type.feature")));
    await user.press(screen.getByRole("button", { name: i18n.t("feedback.send") }));

    expect(await screen.findByText(i18n.t("feedback.success.title"))).toBeTruthy();
    expect(backToAbout()).toBeTruthy();
  });
});
