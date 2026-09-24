import React from "react";
import { AccessibilityInfo } from "react-native";
import renderer, { act } from "react-test-renderer";

import { useScreenReader } from "@/hooks/useScreenReader";

const results: boolean[] = [];
const Probe = () => {
  results.push(useScreenReader());
  return null;
};
const latest = () => results[results.length - 1];

let handler: ((enabled: boolean) => void) | undefined;
let listenedTo: string | undefined;

beforeEach(() => {
  results.length = 0;
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
    await act(async () => {
      renderer.create(<Probe />);
      await Promise.resolve();
    });
    expect(latest()).toBe(true);
    expect(listenedTo).toBe("screenReaderChanged");

    act(() => handler?.(false));
    expect(latest()).toBe(false);
  });
});
