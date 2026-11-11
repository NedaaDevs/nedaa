// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AcknowledgementsScreen from "@/app/settings/acknowledgements";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { CREDITS, GENERAL_CREDITS } from "@/constants/Acknowledgements";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const ALL_CREDITS = [...GENERAL_CREDITS, ...CREDITS];

const renderAcknowledgements = () =>
  renderRouter(
    { [BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS.route]: () => <AcknowledgementsScreen /> },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS.href,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const contributors = () =>
  screen.getByRole("button", { name: t("settings.acknowledgements.contributors.title") });

describe("Acknowledgements", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
  });

  it("heads the screen with its name", async () => {
    await renderAcknowledgements();

    expect(
      screen.getByRole("header", { name: t("settings.acknowledgements.title") })
    ).toBeOnTheScreen();
  });

  // A reader moves between the credits by their headings.
  it.each(ALL_CREDITS.map(({ titleKey }) => titleKey))("titles the %s credit", async (key) => {
    await renderAcknowledgements();

    expect(screen.getByRole("header", { name: t(key) })).toBeOnTheScreen();
  });

  it("names each source's site as a link", async () => {
    await renderAcknowledgements();

    for (const { label } of ALL_CREDITS.flatMap(({ links }) => links)) {
      const name = t("a11y.acknowledgements.openLink", { name: label });
      expect(screen.getByRole("link", { name })).toBeOnTheScreen();
    }
  });

  it("folds the contributors and says whether they show", async () => {
    await renderAcknowledgements();
    expect(contributors()).toBeExpanded();

    await userEvent.press(contributors());

    expect(contributors()).toBeCollapsed();
  });

  it("invites a contribution with a button", async () => {
    await renderAcknowledgements();

    const invite = screen.getByRole("button", {
      name: t("settings.acknowledgements.contribute.cta"),
    });
    expect(invite.props.accessibilityHint).toBe(t("a11y.acknowledgements.contribute"));
  });
});
