import { act, screen, userEvent } from "@testing-library/react-native";

import { LanguageStep } from "@/components/onboarding/flow/steps/LanguageStep";
import { WelcomeStep } from "@/components/onboarding/flow/steps/WelcomeStep";
import { BRAND_ICON_FRAME } from "@/components/ui/brand-icon";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { E2E_ID } from "@/constants/E2E";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { controlProblems } from "@/test-helpers/controls";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { stepProps } from "@/test-helpers/onboardingStepProps";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const t = i18n.t.bind(i18n);
/** Records each change handed to the theme dissolve, then runs it. */
const mockTransition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});
// The store's setLocale has a widget sync that throws in Jest; this stands in.
const setLocaleAction = jest.fn((locale: AppLocale) => {
  void i18n.changeLanguage(locale);
  useAppStore.setState({ locale });
});

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockTransition.mockClear();
  clearHaptics();
  setLocaleAction.mockClear();
  useAppStore.setState({ locale: AppLocale.AR, setLocale: setLocaleAction });
  useLocationStore.setState({ updateAddressTranslation: jest.fn(async () => true) });
});
afterEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

const languageLink = () =>
  `${t("settings.languages.ar.nativeTitle")} · ${t("onboarding.welcome.changeLanguage")}`;

describe("WelcomeStep", () => {
  it("is a clean page: title, tagline, one button and a quiet language link", async () => {
    await renderWithTheme(<WelcomeStep {...stepProps()} />);

    expect(screen.getByText(t("onboarding.welcome.title"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.welcome.tagline"))).toBeTruthy();
    expect(screen.getByTestId(E2E_ID.ONBOARDING_GET_STARTED)).toHaveTextContent(
      t("onboarding.welcome.getStarted")
    );
    expect(screen.getByText(languageLink())).toBeTruthy();
    expect(screen.queryByTestId(ONBOARDING_PART.PREVIEW)).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("names the language in use on the link, in its own script", async () => {
    await renderWithTheme(<WelcomeStep {...stepProps()} />);

    expect(
      screen.getByRole("link", {
        name: t("a11y.join", {
          first: t("settings.languages.ar.nativeTitle"),
          second: t("onboarding.welcome.changeLanguage"),
        }),
      })
    ).toHaveProp("accessibilityHint", t("a11y.onboarding.changeLanguageHint"));
  });

  it("gives the title to the reader as the step's heading", async () => {
    const props = stepProps();
    await renderWithTheme(<WelcomeStep {...props} />);

    expect(screen.getByRole("header", { name: t("onboarding.welcome.title") })).toBeTruthy();
    expect(props.headingRef.current).not.toBeNull();
  });

  it("asks for the language step, then advances", async () => {
    const props = stepProps();
    await renderWithTheme(<WelcomeStep {...props} />);

    await userEvent.press(screen.getByRole("link"));

    expect(props.setSession).toHaveBeenCalledWith({ languageRequested: true });
    expect(jest.mocked(props.setSession).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(props.onNext).mock.invocationCallOrder[0]
    );
  });

  // A language list opened and backed out of must not come back on Get Started.
  it("withdraws the language request, then advances, from the button", async () => {
    const props = stepProps();
    await renderWithTheme(<WelcomeStep {...props} />);

    await userEvent.press(screen.getByTestId(E2E_ID.ONBOARDING_GET_STARTED));

    expect(props.setSession).toHaveBeenCalledWith({ languageRequested: false });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(jest.mocked(props.setSession).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(props.onNext).mock.invocationCallOrder[0]
    );
  });

  it("draws the app icon with the shared brand icon, 96 points square", async () => {
    await renderWithTheme(<WelcomeStep {...stepProps()} />);

    expect(screen.getByTestId(BRAND_ICON_FRAME)).toHaveStyle({ width: 96, height: 96 });
  });

  it("keeps every control named, with a role and a 44pt target", async () => {
    await renderWithTheme(<WelcomeStep {...stepProps()} />);

    expect(controlProblems()).toEqual([]);
  });
});

describe("LanguageStep", () => {
  it("chooses a language through the Settings path", async () => {
    await renderWithTheme(
      <ThemeTransitionContext value={mockTransition}>
        <LanguageStep {...stepProps()} />
      </ThemeTransitionContext>
    );

    await userEvent.press(
      screen.getByRole("radio", { name: new RegExp(t("settings.languages.en.title")) })
    );

    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(setLocaleAction).toHaveBeenCalledWith(AppLocale.EN);
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
  });

  it("marks the language in use", async () => {
    await renderWithTheme(<LanguageStep {...stepProps()} />);

    expect(
      screen.getByRole("radio", { name: new RegExp(t("settings.languages.ar.title")) })
    ).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  });
});
