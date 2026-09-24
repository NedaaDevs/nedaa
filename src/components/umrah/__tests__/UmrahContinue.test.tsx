import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { UmrahContinue } from "@/components/umrah/UmrahContinue";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderCard = () =>
  renderRouter(
    {
      "(tabs)/tools": () => (
        <>
          <UmrahContinue />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.UMRAH.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.TOOLS.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

/** The label the card reads, from the store's own counts. */
const expectedLabel = () => {
  const store = useUmrahGuideStore.getState();
  const { completed, total } = store.getOverallProgress();
  return [
    i18n.t("tools.umrah.continue"),
    i18n.t("tools.umrah.done", { progress: `${completed}/${total}` }),
    i18n.t("tools.umrah.nextStep", { step: i18n.t(store.getCurrentStep()!.titleKey) }),
  ].join(", ");
};

describe("UmrahContinue", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ useWesternNumerals: true });
    useUmrahGuideStore.setState({ activeProgress: null });
  });

  it("shows nothing when no Umrah is under way", async () => {
    await renderCard();

    expect(screen.queryByRole("button")).toBeNull();
  });

  // Where the journey stands and what comes next, read as one button.
  it("reads the journey's progress and its next step", async () => {
    useUmrahGuideStore.getState().startUmrah();
    useUmrahGuideStore.getState().advanceStep();
    await renderCard();

    expect(screen.getByRole("button", { name: expectedLabel() })).toBeTruthy();
  });

  it("opens the guide where it was left", async () => {
    useUmrahGuideStore.getState().startUmrah();
    await renderCard();

    await userEvent.press(screen.getByRole("button", { name: expectedLabel() }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.UMRAH.href)
    );
  });
});
