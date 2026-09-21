import React from "react";
import renderer, { act } from "react-test-renderer";

import { ReminderTimeSheet } from "@/components/quran/sheets/ReminderTimeSheet";

// One entry per MOUNT of the body, so the length counts remounts, not re-renders.
const mockMounts: { hour: number; minute: number }[] = [];

jest.mock("@/components/quran/sheets/ReminderTimeSheetBody", () => ({
  ReminderTimeSheetBody: (props: { hour: number; minute: number }) => {
    const { useState } = jest.requireActual<typeof import("react")>("react");
    // A lazy initialiser runs once per mount and never on a re-render.
    useState(() => mockMounts.push({ hour: props.hour, minute: props.minute }));
    return null;
  },
}));

const noop = () => {};

const render = (props: Partial<React.ComponentProps<typeof ReminderTimeSheet>>) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ReminderTimeSheet
        visible
        title="t"
        hour={5}
        minute={45}
        onConfirm={noop}
        onClose={noop}
        {...props}
      />
    );
  });
  return tree;
};

beforeEach(() => {
  mockMounts.length = 0;
});

describe("ReminderTimeSheet", () => {
  it("renders nothing while hidden", () => {
    const tree = render({ visible: false });
    expect(tree.toJSON()).toBeNull();
    expect(mockMounts).toHaveLength(0);
  });

  it("mounts the body with the caller's time when shown", () => {
    render({});
    expect(mockMounts).toEqual([{ hour: 5, minute: 45 }]);
  });

  it("restarts the body when the caller supplies a new time while open", () => {
    const tree = render({});
    act(() =>
      tree.update(
        <ReminderTimeSheet visible title="t" hour={6} minute={0} onConfirm={noop} onClose={noop} />
      )
    );
    expect(mockMounts).toEqual([
      { hour: 5, minute: 45 },
      { hour: 6, minute: 0 },
    ]);
  });

  it("keeps the body mounted when an unrelated prop changes", () => {
    const tree = render({});
    act(() =>
      tree.update(
        <ReminderTimeSheet
          visible
          title="other"
          hour={5}
          minute={45}
          onConfirm={noop}
          onClose={noop}
        />
      )
    );
    expect(mockMounts).toHaveLength(1);
  });
});
