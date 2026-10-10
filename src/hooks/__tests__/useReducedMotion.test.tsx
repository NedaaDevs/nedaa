import React from "react";
import { AccessibilityInfo } from "react-native";
import renderer, { act } from "react-test-renderer";

import { useReducedMotion } from "@/hooks/useReducedMotion";

const results: boolean[] = [];
const Probe = () => {
  results.push(useReducedMotion());
  return null;
};

const latest = () => results[results.length - 1];

let handler: ((enabled: boolean) => void) | undefined;
let remove: jest.Mock;

const render = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe />);
    await Promise.resolve();
  });
  return tree;
};

beforeEach(() => {
  results.length = 0;
  handler = undefined;
  remove = jest.fn();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    _event: string,
    fn: (enabled: boolean) => void
  ) => {
    handler = fn;
    return { remove } as never;
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

describe("useReducedMotion", () => {
  it("starts false before the query resolves", () => {
    act(() => {
      renderer.create(<Probe />);
    });

    expect(results[0]).toBe(false);
  });

  it("reports the setting the device reports", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render();

    expect(latest()).toBe(true);
  });

  it("follows a change while mounted", async () => {
    await render();
    expect(latest()).toBe(false);

    await act(async () => handler?.(true));

    expect(latest()).toBe(true);
  });

  // A remount starts from what is known, so no first frame animates by mistake.
  it("starts a fresh mount from the last known setting", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const first = await render();
    await act(async () => first.unmount());
    results.length = 0;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(new Promise(() => {}));

    act(() => {
      renderer.create(<Probe />);
    });

    expect(results[0]).toBe(true);
  });

  it("unsubscribes on unmount", async () => {
    const tree = await render();

    await act(async () => tree.unmount());

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("subscribes to the reduce-motion event", async () => {
    await render();

    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith(
      "reduceMotionChanged",
      expect.any(Function)
    );
  });
});
