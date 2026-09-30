// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AboutScreen from "@/app/settings/about";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { LIST_ROW_PART } from "@/components/ui/list-row";
import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { DEBUG_COPY, DEBUG_SCREEN } from "@/constants/DebugScreens";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useDebugModeStore } from "@/stores/debugMode";
import { useWhatsNewSheetStore } from "@/stores/whatsNewSheet";
import { APP_NAME_LATIN } from "@/constants/App";
import { appVersionLabel } from "@/utils/appVersion";
import { LTR_ISOLATE } from "@/utils/digits";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** The rows About leads to, in the order it draws them. */
const ROWS: readonly { titleKey: string; summaryKey: string; to: BackDestination }[] = [
  {
    titleKey: "settings.privacy.title",
    summaryKey: "settings.about.privacySummary",
    to: BACK_DESTINATION.SETTINGS_PRIVACY,
  },
  {
    titleKey: "settings.acknowledgements.title",
    summaryKey: "settings.about.acknowledgementsSummary",
    to: BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS,
  },
  {
    titleKey: "settings.help.title",
    summaryKey: "settings.about.helpSummary",
    to: BACK_DESTINATION.SETTINGS_HELP,
  },
  {
    titleKey: "feedback.title",
    summaryKey: "settings.about.feedbackSummary",
    to: BACK_DESTINATION.SETTINGS_FEEDBACK,
  },
];

const rowName = ({ titleKey, summaryKey }: (typeof ROWS)[number]) =>
  `${i18n.t(titleKey)}, ${i18n.t(summaryKey)}`;

const DEBUG_SCREENS = Object.values(DEBUG_SCREEN);

const renderAbout = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_ABOUT.route]: () => (
        <>
          <AboutScreen />
          <Pathname />
        </>
      ),
      ...Object.fromEntries(ROWS.map(({ to }) => [to.route, () => <Pathname />])),
      ...Object.fromEntries(DEBUG_SCREENS.map(({ route }) => [route, () => <Pathname />])),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_ABOUT.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const versionLine = () =>
  screen.getByLabelText(i18n.t("a11y.about.version", { version: appVersionLabel() }));

const tapVersion = async (times: number) => {
  const user = userEvent.setup();
  for (let i = 0; i < times; i++) await user.press(versionLine());
};

const developerHeader = () => screen.queryByRole("header", { name: DEBUG_COPY.SECTION });

describe("About", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    useDebugModeStore.setState({ isEnabled: false });
  });

  afterEach(async () => {
    await i18n.changeLanguage(AppLocale.EN);
  });

  it("draws the sky behind its content", async () => {
    await renderAbout();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true }).length).toBe(1);
  });

  it("heads the screen with its name", async () => {
    await renderAbout();

    expect(screen.getByRole("header", { name: i18n.t("settings.about.title") })).toBeTruthy();
  });

  it("lists privacy, acknowledgements, help and feedback in order", async () => {
    await renderAbout();

    const labels = screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);
    expect(labels.filter((label) => ROWS.map(rowName).includes(label))).toEqual(ROWS.map(rowName));
  });

  it("sets each row's icon on the tinted tile", async () => {
    await renderAbout();

    expect(screen.getAllByTestId(LIST_ROW_PART.TILE, { includeHiddenElements: true })).toHaveLength(
      ROWS.length
    );
  });

  it("tells a screen reader where each row leads", async () => {
    await renderAbout();

    for (const row of ROWS) {
      expect(screen.getByRole("button", { name: rowName(row) }).props.accessibilityHint).toBe(
        i18n.t("a11y.opens", { name: i18n.t(row.titleKey) })
      );
    }
  });

  it.each(ROWS)("opens $to.route from its row", async (row) => {
    await renderAbout();

    await userEvent.press(screen.getByRole("button", { name: rowName(row) }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(row.to.href));
  });

  it("opens the release notes sheet from the release card", async () => {
    await renderAbout();
    const before = useWhatsNewSheetStore.getState().openRequests;

    await userEvent.press(
      screen.getByRole("button", { name: new RegExp(`^${i18n.t("settings.about.releaseTitle")}`) })
    );

    expect(useWhatsNewSheetStore.getState().openRequests).toBe(before + 1);
  });

  it("shows the app version and build", async () => {
    await renderAbout();

    expect(versionLine()).toBeTruthy();
    expect(versionLine()).toHaveStyle({ minHeight: 44 });
  });

  // The version is a Latin identifier in every language, read left to right.
  it("writes the version line in Latin, isolated left to right, in Arabic too", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await i18n.changeLanguage(AppLocale.AR);
    await renderAbout();

    expect(
      screen.getByText(
        `${LTR_ISOLATE.OPEN}${APP_NAME_LATIN} · ${appVersionLabel()}${LTR_ISOLATE.CLOSE}`
      )
    ).toBeTruthy();
  });

  it("hides the developer rows while debug mode is off", async () => {
    await renderAbout();

    expect(developerHeader()).toBeNull();
    expect(screen.queryByText(DEBUG_COPY.ON)).toBeNull();
  });

  it("shows the developer rows while debug mode is on", async () => {
    useDebugModeStore.setState({ isEnabled: true });
    await renderAbout();

    expect(developerHeader()).toBeTruthy();
    expect(screen.getByText(DEBUG_COPY.ON)).toBeTruthy();
    for (const { label } of DEBUG_SCREENS) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  // Debug rows are not product rows, so their icons stay bare.
  it("leaves the developer rows' icons bare", async () => {
    useDebugModeStore.setState({ isEnabled: true });
    await renderAbout();

    expect(screen.getAllByTestId(LIST_ROW_PART.TILE, { includeHiddenElements: true })).toHaveLength(
      ROWS.length
    );
  });

  it("opens a debug screen from its row", async () => {
    useDebugModeStore.setState({ isEnabled: true });
    await renderAbout();
    const [first] = DEBUG_SCREENS;

    await userEvent.press(screen.getByRole("button", { name: first.label }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(first.href));
  });

  it("turns debug mode on after seven taps on the version", async () => {
    await renderAbout();

    await tapVersion(7);

    expect(useDebugModeStore.getState().isEnabled).toBe(true);
    expect(developerHeader()).toBeTruthy();
  });

  it("leaves debug mode alone after six taps", async () => {
    await renderAbout();

    await tapVersion(6);

    expect(useDebugModeStore.getState().isEnabled).toBe(false);
  });

  it("turns debug mode off after seven more taps", async () => {
    useDebugModeStore.setState({ isEnabled: true });
    await renderAbout();

    await tapVersion(7);

    expect(useDebugModeStore.getState().isEnabled).toBe(false);
    expect(developerHeader()).toBeNull();
  });

  // Taps spread past the window start the count again.
  it("starts the count again after a pause", async () => {
    await renderAbout();
    // After render: the router harness installs fake timers, which replace Date.
    const now = jest.spyOn(Date, "now");

    now.mockReturnValue(0);
    await tapVersion(4);
    now.mockReturnValue(10_000);
    await tapVersion(3);

    now.mockRestore();
    expect(useDebugModeStore.getState().isEnabled).toBe(false);
  });
});
