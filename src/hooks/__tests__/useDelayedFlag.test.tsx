import React, { useLayoutEffect } from "react";
import { act, render } from "@testing-library/react-native";

import { useDelayedFlag } from "@/hooks/useDelayedFlag";

const results: boolean[] = [];

const Probe = ({ value }: { value: boolean }) => {
  results.push(useDelayedFlag(value, 500));
  return null;
};

const latest = () => results[results.length - 1];

const renderProbe = (value: boolean) => render(<Probe value={value} />);

describe("useDelayedFlag", () => {
  beforeEach(() => {
    results.length = 0;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("stays false until the delay elapses", async () => {
    const tree = await renderProbe(false);
    expect(latest()).toBe(false);

    await tree.rerender(<Probe value />);
    expect(latest()).toBe(false);

    await act(() => jest.advanceTimersByTime(499));
    expect(latest()).toBe(false);

    await act(() => jest.advanceTimersByTime(1));
    expect(latest()).toBe(true);

    await tree.unmount();
  });

  it("resets immediately when the value drops", async () => {
    const tree = await renderProbe(true);
    await act(() => jest.advanceTimersByTime(500));
    expect(latest()).toBe(true);

    await tree.rerender(<Probe value={false} />);
    expect(latest()).toBe(false);

    await tree.unmount();
  });

  // A layout effect fires only for a render that commits, so this sees every painted
  // frame and nothing that React threw away.
  it("never commits a true frame once the value has dropped", async () => {
    const committed: boolean[] = [];
    const CommitProbe = ({ value }: { value: boolean }) => {
      const flag = useDelayedFlag(value, 500);
      useLayoutEffect(() => {
        committed.push(flag);
      });
      return null;
    };

    const tree = await render(<CommitProbe value />);
    await act(() => jest.advanceTimersByTime(500));
    expect(committed[committed.length - 1]).toBe(true);
    const dropAt = committed.length;

    await tree.rerender(<CommitProbe value={false} />);
    expect(committed.slice(dropAt)).toEqual([false]);

    await tree.unmount();
  });

  it("restarts the delay on a bounce", async () => {
    const tree = await renderProbe(true);
    await act(() => jest.advanceTimersByTime(300));
    await tree.rerender(<Probe value={false} />);
    await tree.rerender(<Probe value />);
    await act(() => jest.advanceTimersByTime(300));
    expect(latest()).toBe(false);

    await act(() => jest.advanceTimersByTime(200));
    expect(latest()).toBe(true);

    await tree.unmount();
  });
});
