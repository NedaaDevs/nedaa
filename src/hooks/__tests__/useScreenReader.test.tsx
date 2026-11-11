import { AccessibilityInfo } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useScreenReader } from "@/hooks/useScreenReader";

let handler: ((enabled: boolean) => void) | undefined;
let listenedTo: string | undefined;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    event: string,
    fn: (enabled: boolean) => void
  ) => {
    listenedTo = event;
    handler = fn;
    return { remove: jest.fn() } as never;
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe("useScreenReader", () => {
  it("reads whether a screen reader runs, and follows it turning off", async () => {
    const { result } = await renderHook(() => useScreenReader());
    expect(result.current).toBe(true);
    expect(listenedTo).toBe("screenReaderChanged");

    await act(() => handler?.(false));
    expect(result.current).toBe(false);
  });
});
