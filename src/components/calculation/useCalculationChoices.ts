import { useTranslation } from "react-i18next";

import {
  ASR_OPTIONS,
  MIDNIGHT_OPTIONS,
  methodName,
  methodNameKey,
  optionNameKey,
  resolvedMethod,
} from "@/components/calculation/calculationOptions";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useTimesSource } from "@/hooks/useDraftTimes";
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;

/** The calculation as drafted, with the names its rows and sheet show. */
export const useCalculationChoices = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAladhanSettings();
  const applied = useProviderSettingsStore((state) => state.allSettings[ALADHAN.id]);
  const reported = useTimesSource()?.method;

  const draft = settings ?? {};
  const chosen = methodNameKey(draft.method) !== null;
  const method = resolvedMethod(draft.method, applied?.method, reported);
  const asrKey = optionNameKey(ASR_OPTIONS, draft.madhab);
  const midnightKey = optionNameKey(MIDNIGHT_OPTIONS, draft.midnightMode);

  return {
    draft,
    updateSettings,
    /** The method in effect by name: the chosen one, else the provider's. */
    methodLabel: methodName(method, t),
    /** True while the provider picks the method. */
    auto: !chosen,
    asrName: asrKey && t(asrKey),
    midnightName: midnightKey && t(midnightKey),
    /** The method the sheet marks in use while the provider picks one. */
    inUse: chosen ? undefined : method,
  };
};
