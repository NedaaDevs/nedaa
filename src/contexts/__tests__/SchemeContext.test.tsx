import type { ReactNode } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { renderHook } from "@testing-library/react-native";

import { NATIVE_SCHEME } from "@/constants/Appearance";
import { SchemeContext, useAppScheme } from "@/contexts/SchemeContext";
import { AppMode } from "@/enums/app";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useAppStore } from "@/stores/app";

const mockUseColorScheme = jest.fn(() => NATIVE_SCHEME.DARK);
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () => mockUseColorScheme(),
}));

const holding = (scheme: ColorSchemeName) => {
  const Holding = ({ children }: { children: ReactNode }) => (
    <SchemeContext value={scheme}>{children}</SchemeContext>
  );
  return Holding;
};

describe("useAppScheme", () => {
  beforeEach(() => {
    mockUseColorScheme.mockClear();
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue(NATIVE_SCHEME.DARK);
  });

  afterEach(() => jest.restoreAllMocks());

  it("reads the phone's scheme when nothing holds one", async () => {
    const { result } = await renderHook(() => useAppScheme());

    expect(result.current).toBe(NATIVE_SCHEME.DARK);
  });

  it("reads the scheme the root holds over the phone's", async () => {
    const { result } = await renderHook(() => useAppScheme(), {
      wrapper: holding(NATIVE_SCHEME.LIGHT),
    });

    expect(result.current).toBe(NATIVE_SCHEME.LIGHT);
  });

  // The root already follows the phone; a second subscription per reader is waste.
  it("does not subscribe to the phone under the root", async () => {
    await renderHook(() => useAppScheme(), { wrapper: holding(NATIVE_SCHEME.LIGHT) });

    expect(mockUseColorScheme).not.toHaveBeenCalled();
  });

  // A System flip draws dark only once the root lets it through.
  it("is what useAppIsDark reads under System", async () => {
    useAppStore.setState({ mode: AppMode.SYSTEM });

    const { result } = await renderHook(() => useAppIsDark(), {
      wrapper: holding(NATIVE_SCHEME.LIGHT),
    });

    expect(result.current).toBe(false);
  });
});
