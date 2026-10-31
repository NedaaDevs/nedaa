import { act, renderHook } from "@testing-library/react-native";

import { useCalculationChoices } from "@/components/calculation/useCalculationChoices";
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import type { AladhanSettings } from "@/types/providers/aladhan";

const t = i18n.t.bind(i18n);
const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const MWL = ALADHAN.methods.find(({ nameKey }) => nameKey === "mwl")!;
const MWL_NAME = () => t(`providers.aladhan.methods.${MWL.nameKey}`);

/** The applied settings, and what the provider reported for the times. */
const stored = (applied: AladhanSettings, inEffect: AladhanSettings | null = null) =>
  useProviderSettingsStore.setState({
    currentProviderId: ALADHAN.id,
    allSettings: { [ALADHAN.id]: applied },
    draft: null,
    isModified: false,
    pendingReapply: false,
    inEffect,
  });

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

it("names the chosen method and options as its rows show them", async () => {
  stored({ method: MWL.id, madhab: ASR_SCHOOL.HANAFI, midnightMode: MIDNIGHT_MODE.JAFARI });
  const { result } = await renderHook(() => useCalculationChoices());

  expect(result.current).toMatchObject({
    methodLabel: MWL_NAME(),
    auto: false,
    asrName: t("settings.calculation.asr.options.hanafi.name"),
    midnightName: t("settings.calculation.midnight.options.jafari.name"),
    inUse: undefined,
  });
});

it("names the provider's method while the choice is left to it, and marks it in use", async () => {
  stored({}, { method: MWL.id });
  const { result } = await renderHook(() => useCalculationChoices());

  expect(result.current).toMatchObject({
    methodLabel: MWL_NAME(),
    auto: true,
    asrName: undefined,
    midnightName: undefined,
    inUse: MWL.id,
  });
});

it("says the provider chooses when it has reported no method", async () => {
  stored({});
  const { result } = await renderHook(() => useCalculationChoices());

  expect(result.current.methodLabel).toBe(t("settings.summary.methodAuto"));
  expect(result.current.auto).toBe(true);
});
