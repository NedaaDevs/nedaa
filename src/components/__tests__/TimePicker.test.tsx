import React from "react";
import { render, screen } from "@testing-library/react-native";

import TimePicker from "@/components/TimePicker";

// Each entry is one MOUNT of the body with the props it mounted with. A re-render of
// an already-mounted body adds nothing, so the length counts remounts.
const mockMounts: { currentHour: number; currentMinute: number }[] = [];

jest.mock("@/components/TimePickerBody", () => ({
  TimePickerBody: (props: { currentHour: number; currentMinute: number }) => {
    const { useState } = jest.requireActual<typeof import("react")>("react");
    // A lazy initialiser runs once per mount and never on a re-render.
    useState(() =>
      mockMounts.push({ currentHour: props.currentHour, currentMinute: props.currentMinute })
    );
    return null;
  },
}));

const noop = () => {};

const show = (props: Partial<React.ComponentProps<typeof TimePicker>>) =>
  render(
    <TimePicker
      isVisible
      currentHour={7}
      currentMinute={30}
      onTimeChange={noop}
      onClose={noop}
      {...props}
    />
  );

beforeEach(() => {
  mockMounts.length = 0;
});

describe("TimePicker", () => {
  it("renders nothing while hidden", async () => {
    await show({ isVisible: false });
    expect(screen.toJSON()).toBeNull();
    expect(mockMounts).toHaveLength(0);
  });

  it("mounts the body with the caller's time when shown", async () => {
    await show({});
    expect(mockMounts).toEqual([{ currentHour: 7, currentMinute: 30 }]);
  });

  it("restarts the body when the caller supplies a new time while open", async () => {
    await show({});
    await screen.rerender(
      <TimePicker isVisible currentHour={9} currentMinute={15} onTimeChange={noop} onClose={noop} />
    );
    expect(mockMounts).toEqual([
      { currentHour: 7, currentMinute: 30 },
      { currentHour: 9, currentMinute: 15 },
    ]);
  });

  it("keeps the body mounted when an unrelated prop changes", async () => {
    await show({});
    await screen.rerender(
      <TimePicker
        isVisible
        currentHour={7}
        currentMinute={30}
        onTimeChange={noop}
        onClose={noop}
        isPM
      />
    );
    expect(mockMounts).toHaveLength(1);
  });
});
