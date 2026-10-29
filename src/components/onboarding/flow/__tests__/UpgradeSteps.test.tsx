import { act, screen, userEvent } from "@testing-library/react-native";

import { CompleteStep } from "@/components/onboarding/flow/steps/CompleteStep";
import { UpgradeWelcomeStep } from "@/components/onboarding/flow/steps/UpgradeWelcomeStep";
import { SkyBackground } from "@/components/ui/sky-background";
import { ONBOARDING_PATH } from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { stepProps } from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const t = i18n.t.bind(i18n);
const upgradeProps = () => stepProps({ path: ONBOARDING_PATH.UPGRADE });

const renderWelcome = async () => {
  const props = upgradeProps();
  await renderWithTheme(
    <SkyBackground>
      <UpgradeWelcomeStep {...props} />
    </SkyBackground>
  );
  return props;
};
const exit = (key: string) => screen.getByRole("button", { name: t(key) });

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useAppStore.setState({ locale: AppLocale.EN, upgradePath: UPGRADE_PATH_STATE.PENDING });
});

describe("UpgradeWelcomeStep", () => {
  it("the welcome offers three ways out", async () => {
    await renderWelcome();

    expect(screen.getByRole("header", { name: t("onboarding.upgrade.title") })).toBeOnTheScreen();
    expect(screen.getByText(t("onboarding.upgrade.body"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.keptTitle"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.kept"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.newTitle"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.new"))).toBeTruthy();
    expect(screen.getAllByRole(/button|link/).map((c) => c.props.accessibilityLabel)).toEqual([
      t("onboarding.upgrade.start"),
      t("onboarding.upgrade.later"),
      t("onboarding.upgrade.keep"),
    ]);
    expect(exit("onboarding.upgrade.later").props.accessibilityHint).toBe(
      t("a11y.onboarding.upgradeLaterHint")
    );
    expect(exit("onboarding.upgrade.keep").props.accessibilityHint).toBe(
      t("a11y.onboarding.upgradeKeepHint")
    );
  });

  it("starts the path from its first button", async () => {
    const props = await renderWelcome();

    await userEvent.press(exit("onboarding.upgrade.start"));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.PENDING);
  });

  it("Later leaves the path for the Today card", async () => {
    const props = await renderWelcome();

    await userEvent.press(exit("onboarding.upgrade.later"));

    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.LATER);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("Keep my settings ends the path", async () => {
    const props = await renderWelcome();

    await userEvent.press(exit("onboarding.upgrade.keep"));

    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("every welcome control meets the target size", async () => {
    await renderWelcome();

    expect(controlProblems()).toEqual([]);
  });
});

describe("CompleteStep on the upgrade path", () => {
  beforeEach(() => {
    useLocationStore.setState({
      localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
    });
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: false });
  });

  it("the upgrade complete step says what stayed", async () => {
    await renderWithTheme(<CompleteStep {...upgradeProps()} />);

    expect(screen.getByText(t("onboarding.complete.title"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.upgrade.completeBody"))).toBeTruthy();
    expect(screen.queryByText(t("onboarding.complete.body"))).toBeNull();
  });
});
