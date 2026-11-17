import { renderHook } from "@testing-library/react-native";

import { AppLocale } from "@/enums/app";
import { useRatioText } from "@/hooks/useRatioText";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { LTR_ISOLATE } from "@/utils/digits";

const held = (text: string) => `${LTR_ISOLATE.OPEN}${text}${LTR_ISOLATE.CLOSE}`;

const ratioIn = async (locale: AppLocale, useWesternNumerals: boolean) => {
  useAppStore.setState({ locale });
  usePreferencesStore.setState({ useWesternNumerals });
  const { result } = await renderHook(() => useRatioText());
  return result.current(9, 18);
};

describe("useRatioText", () => {
  it("writes Western digits in English", async () => {
    await expect(ratioIn(AppLocale.EN, false)).resolves.toBe(held("9 / 18"));
  });

  it("keeps Arabic digits for an Arabic reader who has not chosen Western ones", async () => {
    await expect(ratioIn(AppLocale.AR, false)).resolves.toBe(held("٩ / ١٨"));
  });

  it("writes Western digits for an Arabic reader who chose them", async () => {
    await expect(ratioIn(AppLocale.AR, true)).resolves.toBe(held("9 / 18"));
  });
});
