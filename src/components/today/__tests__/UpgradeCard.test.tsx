import { fireEvent, screen, userEvent } from "@testing-library/react-native";

import { UPGRADE_CARD_PART, UpgradeCard } from "@/components/today/UpgradeCard";
import { SkyBackground } from "@/components/ui/sky-background";
import { SKY_SWATCH_ID } from "@/components/ui/sky-preview";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { ONBOARDING_PATH } from "@/constants/Onboarding";
import { PHASE } from "@/constants/Phase";
import { UPGRADE_PATH_STATE, type UpgradePathState } from "@/constants/UpgradePath";
import { AlertLaunchContext } from "@/contexts/AlertLaunchContext";
import { PhaseContext } from "@/contexts/PhaseContext";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import { onboardingPathFor } from "@/utils/onboardingPath";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));

const t = i18n.t.bind(i18n);

const renderCard = (state: UpgradePathState, alertLaunch = false) => {
  useAppStore.setState({ upgradePath: state });
  return renderWithTheme(
    <AlertLaunchContext value={alertLaunch}>
      <PhaseContext value={PHASE.DAY}>
        <SkyBackground>
          <UpgradeCard />
        </SkyBackground>
      </PhaseContext>
    </AlertLaunchContext>
  );
};
/** The walk this launch's gate opens, with no alert behind the launch. */
const openedPath = () =>
  onboardingPathFor({
    isFirstRun: false,
    upgradePath: useAppStore.getState().upgradePath,
    launchedByAlert: false,
    alarmScreenSeen: false,
  });

const title = () => t("onboarding.upgrade.title");
const body = () => t("onboarding.upgrade.cardBody");
const card = () => screen.getByLabelText(t("a11y.join", { first: title(), second: body() }));

describe("UpgradeCard", () => {
  it("shows only after Later", async () => {
    for (const state of [
      UPGRADE_PATH_STATE.PENDING,
      UPGRADE_PATH_STATE.RESUMED,
      UPGRADE_PATH_STATE.DONE,
    ]) {
      const view = await renderCard(state);
      expect(screen.queryByText(title())).toBeNull();
      await view.unmount();
    }
    await renderCard(UPGRADE_PATH_STATE.LATER);

    expect(screen.getByText(title())).toBeTruthy();
    expect(screen.getByText(body())).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.start"))).toBeTruthy();
    expect(screen.getByTestId(SKY_SWATCH_ID)).toBeTruthy();
  });

  it("opens the path at Appearance", async () => {
    await renderCard(UPGRADE_PATH_STATE.LATER);

    await userEvent.press(card());

    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.RESUMED);
    expect(openedPath()).toBe(ONBOARDING_PATH.UPGRADE);
  });

  // The gate opens nothing on such a launch, so a press would lead nowhere.
  it("hides while an alert holds the path for this launch", async () => {
    await renderCard(UPGRADE_PATH_STATE.LATER, true);

    expect(screen.queryByTestId(UPGRADE_CARD_PART.FRAME)).toBeNull();
    expect(screen.queryByText(title())).toBeNull();
  });

  it("the dismiss action ends the path", async () => {
    await renderCard(UPGRADE_PATH_STATE.LATER);

    expect(card().props.accessibilityActions).toEqual([
      { name: A11Y_ACTION.DISMISS, label: t("onboarding.upgrade.keep") },
    ]);
    fireEvent(card(), "accessibilityAction", {
      nativeEvent: { actionName: A11Y_ACTION.DISMISS },
    });

    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
  });

  it("the ✕ ends the path and is hidden from the reader", async () => {
    await renderCard(UPGRADE_PATH_STATE.LATER);
    const close = screen.getByTestId(UPGRADE_CARD_PART.DISMISS, { includeHiddenElements: true });

    expect(close.props.accessibilityElementsHidden).toBe(true);
    expect(close.props.importantForAccessibility).toBe("no-hide-descendants");
    await userEvent.press(close);

    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
  });

  it("the card is one button with a label and hint", async () => {
    await renderCard(UPGRADE_PATH_STATE.LATER);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(card().props.accessibilityHint).toBe(t("a11y.today.upgradeCardHint"));
    expect(controlProblems()).toEqual([]);
  });

  it("no gap appears when the card is hidden", async () => {
    await renderCard(UPGRADE_PATH_STATE.DONE);

    expect(screen.queryByTestId(UPGRADE_CARD_PART.FRAME)).toBeNull();
  });
});
