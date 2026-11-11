import { AccessibilityInfo } from "react-native";
import { act, render } from "@testing-library/react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

const results: boolean[] = [];
const Probe = () => {
  results.push(useReducedMotion());
  return null;
};

const latest = () => results[results.length - 1];

let handler: ((enabled: boolean) => void) | undefined;
let remove: jest.Mock;

const renderProbe = () => render(<Probe />);

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
  it("starts false before the query resolves", async () => {
    await renderProbe();

    expect(results[0]).toBe(false);
  });

  it("reports the setting the device reports", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderProbe();

    expect(latest()).toBe(true);
  });

  it("follows a change while mounted", async () => {
    await renderProbe();
    expect(latest()).toBe(false);

    await act(() => handler?.(true));

    expect(latest()).toBe(true);
  });

  // A remount starts from what is known, so no first frame animates by mistake.
  it("starts a fresh mount from the last known setting", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const first = await renderProbe();
    await first.unmount();
    results.length = 0;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(new Promise(() => {}));

    await renderProbe();

    expect(results[0]).toBe(true);
  });

  it("unsubscribes on unmount", async () => {
    const tree = await renderProbe();

    await tree.unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("subscribes to the reduce-motion event", async () => {
    await renderProbe();

    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith(
      "reduceMotionChanged",
      expect.any(Function)
    );
  });
});
