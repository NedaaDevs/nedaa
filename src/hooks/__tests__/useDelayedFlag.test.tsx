import React from "react";
import renderer, { act } from "react-test-renderer";

import { useDelayedFlag } from "@/hooks/useDelayedFlag";

const results: boolean[] = [];

const Probe = ({ value }: { value: boolean }) => {
  results.push(useDelayedFlag(value, 500));
  return null;
};

const latest = () => results[results.length - 1];

const renderProbe = (value: boolean) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Probe value={value} />);
  });
  return tree;
};

describe("useDelayedFlag", () => {
  beforeEach(() => {
    results.length = 0;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("stays false until the delay elapses", () => {
    const tree = renderProbe(false);
    expect(latest()).toBe(false);

    act(() => tree.update(<Probe value />));
    expect(latest()).toBe(false);

    act(() => jest.advanceTimersByTime(499));
    expect(latest()).toBe(false);

    act(() => jest.advanceTimersByTime(1));
    expect(latest()).toBe(true);

    act(() => tree.unmount());
  });

  it("resets immediately when the value drops", () => {
    const tree = renderProbe(true);
    act(() => jest.advanceTimersByTime(500));
    expect(latest()).toBe(true);

    act(() => tree.update(<Probe value={false} />));
    expect(latest()).toBe(false);

    act(() => tree.unmount());
  });

  it("restarts the delay on a bounce", () => {
    const tree = renderProbe(true);
    act(() => jest.advanceTimersByTime(300));
    act(() => tree.update(<Probe value={false} />));
    act(() => tree.update(<Probe value />));
    act(() => jest.advanceTimersByTime(300));
    expect(latest()).toBe(false);

    act(() => jest.advanceTimersByTime(200));
    expect(latest()).toBe(true);

    act(() => tree.unmount());
  });
});
