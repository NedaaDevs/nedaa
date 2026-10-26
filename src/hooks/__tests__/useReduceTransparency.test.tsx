import { AccessibilityInfo, Platform } from "react-native";
import { act, render } from "@testing-library/react-native";

import { PlatformType } from "@/enums/app";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";

const results: boolean[] = [];
const Probe = () => {
  results.push(useReduceTransparency());
  return null;
};

const latest = () => results[results.length - 1];

let handler: ((enabled: boolean) => void) | undefined;
let remove: jest.Mock;
const originalOS = Platform.OS;

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
};

beforeEach(() => {
  results.length = 0;
  handler = undefined;
  remove = jest.fn();
  setPlatform(PlatformType.IOS);
  jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    _event: string,
    fn: (enabled: boolean) => void
  ) => {
    handler = fn;
    return { remove } as never;
  }) as never);
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

describe("useReduceTransparency", () => {
  it("reports the setting the device reports on iOS", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
    await render(<Probe />);

    expect(latest()).toBe(true);
  });

  it("follows a change while mounted", async () => {
    await render(<Probe />);
    expect(latest()).toBe(false);

    await act(() => handler?.(true));

    expect(latest()).toBe(true);
  });

  it("subscribes to the reduce-transparency event", async () => {
    await render(<Probe />);

    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith(
      "reduceTransparencyChanged",
      expect.any(Function)
    );
  });

  it("unsubscribes on unmount", async () => {
    const tree = await render(<Probe />);

    await tree.unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("is false on Android whatever the query reports", async () => {
    setPlatform(PlatformType.ANDROID);
    jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
    await render(<Probe />);
    await act(() => handler?.(true));

    expect(latest()).toBe(false);
  });
});
