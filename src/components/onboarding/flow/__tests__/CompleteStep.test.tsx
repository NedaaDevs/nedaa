import { act, screen, userEvent } from "@testing-library/react-native";

import { CompleteStep } from "@/components/onboarding/flow/steps/CompleteStep";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { clearHaptics, firedHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { stepProps } from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const t = i18n.t.bind(i18n);

const open = () => screen.getByTestId(ONBOARDING_PART.COMPLETE_OPEN);

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useLocationStore.setState({
    localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
  });
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: false });
  clearHaptics();
});

it("opens Today from its own button, with no frame primary", async () => {
  const props = stepProps();
  await renderWithTheme(<CompleteStep {...props} />);
  expect(open()).toHaveAccessibleName(t("onboarding.complete.open"));

  await userEvent.press(open());

  expect(props.onNext).toHaveBeenCalledTimes(1);
  expect(props.setPrimary).not.toHaveBeenCalled();
});

it("offers Open Today as its one button", async () => {
  await renderWithTheme(<CompleteStep {...stepProps()} />);

  expect(screen.getAllByRole("button")).toEqual([open()]);
});

it("says the times wait for a city when none were fetched", async () => {
  usePrayerTimesStore.setState({ todayTimings: null });
  await renderWithTheme(<CompleteStep {...stepProps()} />);

  expect(screen.getByText(t("onboarding.complete.bodyNoCity"))).toBeTruthy();
  expect(screen.queryByText(t("onboarding.complete.body"))).toBeNull();
});

it("says the times wait for a city when the stored times are the default place's", async () => {
  usePrayerTimesStore.setState({ usingDefaultLocation: true });
  await renderWithTheme(<CompleteStep {...stepProps()} />);

  expect(screen.getByText(t("onboarding.complete.bodyNoCity"))).toBeTruthy();
});

it("says the times wait when a day is stored but no city is named", async () => {
  useLocationStore.setState({
    localizedLocation: { city: "", country: "" },
    locationDetails: { ...useLocationStore.getState().locationDetails, address: null },
  });
  await renderWithTheme(<CompleteStep {...stepProps()} />);

  expect(screen.getByText(t("onboarding.complete.bodyNoCity"))).toBeTruthy();
  expect(screen.queryByText(t("onboarding.complete.body"))).toBeNull();
});

it("names the chosen setup when the times are stored", async () => {
  await renderWithTheme(<CompleteStep {...stepProps()} />);

  expect(screen.getByText(t("onboarding.complete.body"))).toBeTruthy();
});

it("plays the success haptic once on arrival", async () => {
  const view = await renderWithTheme(<CompleteStep {...stepProps()} />);
  await view.rerender(<CompleteStep {...stepProps()} />);

  expect(HAPTIC.success).toHaveBeenCalledTimes(1);
  expect(firedHaptics()).toEqual(["success"]);
});

it("hands reader focus a heading of the title alone, and labels its button", async () => {
  const props = stepProps();
  await renderWithTheme(<CompleteStep {...props} />);

  expect(screen.getByRole("header")).toHaveAccessibleName(t("onboarding.complete.title"));
  expect(props.headingRef.current).not.toBeNull();
  expect(controlProblems()).toEqual([]);
});
