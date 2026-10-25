import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { CalculationStep } from "@/components/onboarding/flow/steps/CalculationStep";
import { CALCULATION_PICKER, CALCULATION_TITLE_KEY } from "@/constants/Calculation";
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { HAPTIC } from "@/test-helpers/hapticMock";
import { lastPrimary, stepProps } from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY, RIYADH_ZONE } from "@/test-helpers/prayerDay";
import { later } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import type { SchedulingResult } from "@/types/notification";
import type { AladhanSettings } from "@/types/providers/aladhan";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/utils/alarmScheduler", () => ({
  ...jest.requireActual("@/utils/alarmScheduler"),
  rescheduleAllAlarms: jest.fn(() => Promise.resolve()),
}));

const t = i18n.t.bind(i18n);
const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const MAKKAH = ALADHAN.methods.find(({ nameKey }) => nameKey === "makkah")!;
const MWL = ALADHAN.methods.find(({ nameKey }) => nameKey === "mwl")!;
const applied = (patch: Partial<AladhanSettings> = {}) =>
  useProviderSettingsStore.setState({
    currentProviderId: ALADHAN.id,
    allSettings: {
      [ALADHAN.id]: { madhab: ASR_SCHOOL.SHAFI, midnightMode: MIDNIGHT_MODE.STANDARD, ...patch },
    },
    draft: null,
    isModified: false,
    pendingReapply: false,
    inEffect: null,
    applying: false,
    applyStep: null,
  });
const methodName = (nameKey: string) =>
  new RegExp(t(`providers.aladhan.methods.${nameKey}`).replace(/[()]/g, "."));
const chooseMwl = async () => {
  await userEvent.press(
    screen.getByRole("button", { name: new RegExp(t("providers.aladhan.method.title")) })
  );
  await userEvent.press(
    screen.getByRole("radio", { name: t(`providers.aladhan.methods.${MWL.nameKey}`) })
  );
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
  usePreferencesStore.setState({ use24HourTime: true, useWesternNumerals: true });
  useLocationStore.setState({
    localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
    locationDetails: { ...useLocationStore.getState().locationDetails, timezone: RIYADH_ZONE },
  });
  usePrayerTimesStore.setState({
    todayTimings: RIYADH_DAY,
    hasError: false,
    isLoading: false,
    loadPrayerTimes: jest.fn(() => Promise.resolve(true)),
  });
  useNotificationStore.setState({
    scheduleAllNotifications: jest.fn(async (): Promise<SchedulingResult> => ({
      success: true,
      scheduledCount: 0,
    })),
  });
  applied({ method: MAKKAH.id });
});
afterEach(() => jest.restoreAllMocks());

it("names the method the provider used for the stored times", async () => {
  applied();
  useProviderSettingsStore.setState({ inEffect: { method: MAKKAH.id } });
  await renderWithTheme(<CalculationStep {...stepProps()} />);

  expect(
    screen.getByRole("button", {
      name: new RegExp(t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD])),
    })
  ).toHaveAccessibleName(methodName(MAKKAH.nameKey));
});

it("keeps Continue while nothing changed", async () => {
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);

  expect(lastPrimary(props.setPrimary)).toBeNull();
});

it("offers to apply a drafted method, then applies and continues", async () => {
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);
  await chooseMwl();
  expect(lastPrimary(props.setPrimary)?.label).toBe(t("onboarding.calculation.apply"));

  await act(async () => lastPrimary(props.setPrimary)?.onPress());

  await waitFor(() => expect(props.onNext).toHaveBeenCalledTimes(1));
  expect(useProviderSettingsStore.getState().getCurrentSettings()?.method).toBe(MWL.id);
  // With no reapply pending, appSetup loads the stored day unforced.
  expect(useProviderSettingsStore.getState().pendingReapply).toBe(false);
});

it("stays with the draft after a failed apply", async () => {
  // The apply logs its failure to the console in development builds.
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  const load = jest.fn(() => Promise.reject(new Error("offline")));
  usePrayerTimesStore.setState({ loadPrayerTimes: load });
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);
  await chooseMwl();

  await act(async () => lastPrimary(props.setPrimary)?.onPress());
  await waitFor(() => expect(load).toHaveBeenCalled());
  await waitFor(() => expect(useProviderSettingsStore.getState().applying).toBe(false));
  await act(async () => {});

  expect(errorLog).toHaveBeenCalledWith(
    "[Settings]",
    expect.stringContaining("applying provider settings failed")
  );
  expect(props.onNext).not.toHaveBeenCalled();
  expect(useProviderSettingsStore.getState().isModified).toBe(true);
  expect(lastPrimary(props.setPrimary)?.label).toBe(t("onboarding.calculation.apply"));
});

it("leaves per-prayer tuning to Settings", async () => {
  await renderWithTheme(<CalculationStep {...stepProps()} />);

  expect(
    screen.queryByRole("button", { name: new RegExp(t("settings.calculation.tuning.title")) })
  ).toBeNull();
  expect(screen.getByText(t("onboarding.calculation.tuningLater"))).toBeTruthy();
});

it("names the city the choices calculate for", async () => {
  await renderWithTheme(<CalculationStep {...stepProps()} />);

  expect(screen.getByText(t("onboarding.calculation.intro", { city: "Riyadh" }))).toBeTruthy();
});

it("introduces the choices without a city when none is known", async () => {
  useLocationStore.setState({ localizedLocation: { city: "", country: "" } });
  await renderWithTheme(<CalculationStep {...stepProps()} />);

  expect(screen.getByText(t("settings.calculation.introNoPlace"))).toBeTruthy();
});

it("drafts the Asr school from its own row, with one selection tick", async () => {
  HAPTIC.selection.mockClear();
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);

  await userEvent.press(
    screen.getByRole("button", { name: new RegExp(t("settings.calculation.asr.title")) })
  );
  await userEvent.press(
    screen.getByRole("radio", {
      name: new RegExp(t("settings.calculation.asr.options.hanafi.name")),
    })
  );

  expect(useProviderSettingsStore.getState().getDraftSettings()?.madhab).toBe(ASR_SCHOOL.HANAFI);
  expect(lastPrimary(props.setPrimary)?.label).toBe(t("onboarding.calculation.apply"));
  expect(HAPTIC.selection).toHaveBeenCalledTimes(1);
});

it("holds back and skip while the apply runs", async () => {
  const load = later<boolean>();
  usePrayerTimesStore.setState({ loadPrayerTimes: jest.fn(() => load.promise) });
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);
  await chooseMwl();

  await act(async () => lastPrimary(props.setPrimary)?.onPress());
  await waitFor(() => expect(props.setBusy).toHaveBeenLastCalledWith(true));
  expect(props.onNext).not.toHaveBeenCalled();

  await act(async () => load.release(true));
  await waitFor(() => expect(props.onNext).toHaveBeenCalledTimes(1));
  expect(props.setBusy).toHaveBeenLastCalledWith(false);
});

it("drafts the midnight mode from its own row", async () => {
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);

  await userEvent.press(
    screen.getByRole("button", { name: new RegExp(t("settings.calculation.midnight.title")) })
  );
  await userEvent.press(
    screen.getByRole("radio", {
      name: new RegExp(t("settings.calculation.midnight.options.jafari.name")),
    })
  );

  expect(useProviderSettingsStore.getState().getDraftSettings()?.midnightMode).toBe(
    MIDNIGHT_MODE.JAFARI
  );
  expect(lastPrimary(props.setPrimary)?.label).toBe(t("onboarding.calculation.apply"));
});

it("disables the method card and the rows while the apply runs", async () => {
  const load = later<boolean>();
  usePrayerTimesStore.setState({ loadPrayerTimes: jest.fn(() => load.promise) });
  const props = stepProps();
  await renderWithTheme(<CalculationStep {...props} />);
  await chooseMwl();
  const choices = [
    t("providers.aladhan.method.title"),
    t("settings.calculation.asr.title"),
    t("settings.calculation.midnight.title"),
  ].map((title) => screen.getByRole("button", { name: new RegExp(title) }));
  for (const choice of choices) expect(choice).toBeEnabled();

  await act(async () => lastPrimary(props.setPrimary)?.onPress());
  await waitFor(() => expect(props.setBusy).toHaveBeenLastCalledWith(true));
  for (const choice of choices) expect(choice).toBeDisabled();

  await act(async () => load.release(true));
  await waitFor(() => expect(props.onNext).toHaveBeenCalledTimes(1));
});

it("drops an unapplied draft when the step leaves", async () => {
  const { unmount } = await renderWithTheme(<CalculationStep {...stepProps()} />);
  await chooseMwl();
  expect(useProviderSettingsStore.getState().isModified).toBe(true);

  await act(async () => unmount());

  const store = useProviderSettingsStore.getState();
  expect(store.draft).toBeNull();
  expect(store.isModified).toBe(false);
  expect(store.getCurrentSettings()?.method).toBe(MAKKAH.id);
});

it("keeps the draft for a running apply when the step leaves", async () => {
  const load = later<boolean>();
  usePrayerTimesStore.setState({ loadPrayerTimes: jest.fn(() => load.promise) });
  const props = stepProps();
  const { unmount } = await renderWithTheme(<CalculationStep {...props} />);
  await chooseMwl();
  await act(async () => lastPrimary(props.setPrimary)?.onPress());
  await waitFor(() => expect(useProviderSettingsStore.getState().applying).toBe(true));

  await act(async () => unmount());
  expect(useProviderSettingsStore.getState().isModified).toBe(true);

  await act(async () => load.release(true));
  await waitFor(() => expect(useProviderSettingsStore.getState().applying).toBe(false));
  expect(useProviderSettingsStore.getState().getCurrentSettings()?.method).toBe(MWL.id);
  expect(useProviderSettingsStore.getState().isModified).toBe(false);
});
