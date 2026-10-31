import { renderHook } from "@testing-library/react-native";

import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { AppLocale } from "@/enums/app";
import { useChooseLanguage } from "@/hooks/useChooseLanguage";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

const transition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});
const updateAddressTranslation = jest.fn(async () => true);
// The store's own setLocale syncs widgets through a dynamic import, which
// throws inside the Jest VM.
const setLocale = jest.fn((locale: AppLocale) => useAppStore.setState({ locale }));

describe("useChooseLanguage", () => {
  beforeEach(() => {
    transition.mockClear();
    updateAddressTranslation.mockClear();
    useAppStore.setState({ locale: AppLocale.EN, setLocale });
    useLocationStore.setState({ updateAddressTranslation });
  });

  // Both taps come from one render, before it redraws in the new language.
  it("ignores a second choice of the language just applied", async () => {
    const { result } = await renderHook(() => useChooseLanguage(), {
      wrapper: ({ children }) => (
        <ThemeTransitionContext value={transition}>{children}</ThemeTransitionContext>
      ),
    });
    const choose = result.current;

    await choose(AppLocale.AR);
    await choose(AppLocale.AR);

    expect(transition).toHaveBeenCalledTimes(1);
    expect(updateAddressTranslation).toHaveBeenCalledTimes(1);
  });
});
