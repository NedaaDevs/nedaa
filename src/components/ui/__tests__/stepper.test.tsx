import { useState } from "react";
import { Platform, Text } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { RTLContext } from "@/contexts/RTLContext";
import { RETENTION_SLOP } from "@/components/ui/pressable/retention";
import { STEPPER_PART, Stepper } from "@/components/ui/stepper";
import { PlatformType } from "@/enums/app";

// RTLContext reaches the app store, which persists through SQLite.
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const mockHaptic = jest.fn();
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => mockHaptic }));

const LABEL = "Days to add";
const MIN = 1;
const MAX = 999;

/** Holds the value the way a screen does, and draws it where a test can read it. */
const Harness = ({
  start,
  disabled,
  isRTL = false,
}: {
  start: number;
  disabled?: boolean;
  isRTL?: boolean;
}) => {
  const [value, setValue] = useState(start);
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <RTLContext value={{ isRTL, direction: isRTL ? "rtl" : "ltr" }}>
        <Stepper
          value={value}
          onChange={setValue}
          min={MIN}
          max={MAX}
          accessibilityLabel={LABEL}
          valueText={`${value} days`}
          disabled={disabled}>
          <Text testID="value">{value}</Text>
        </Stepper>
      </RTLContext>
    </TamaguiProvider>
  );
};

const shown = () =>
  Number(screen.getByTestId("value", { includeHiddenElements: true }).props.children);
const part = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });
const adjustable = () => screen.getByRole("adjustable", { name: LABEL });

describe("Stepper", () => {
  describe("screen reader", () => {
    afterEach(() => jest.restoreAllMocks());

    it("is one adjustable element that speaks its value", async () => {
      await render(<Harness start={5} />);

      expect(adjustable()).toHaveAccessibilityValue({ min: MIN, max: MAX, now: 5, text: "5 days" });
      // The buttons would be extra stops inside the adjustable element.
      expect(screen.queryAllByRole("button")).toEqual([]);
    });

    it.each([
      ["increment", 6],
      ["decrement", 4],
    ])("steps once on %s", async (actionName, expected) => {
      await render(<Harness start={5} />);

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", { nativeEvent: { actionName } })
      );

      expect(shown()).toBe(expected);
    });

    it("stops at the bounds", async () => {
      await render(<Harness start={MAX} />);

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
      );

      expect(shown()).toBe(MAX);
    });

    it("reports disabled", async () => {
      await render(<Harness start={5} disabled />);

      expect(adjustable()).toBeDisabled();
    });

    it("ignores an adjustment while disabled", async () => {
      await render(<Harness start={5} disabled />);

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
      );

      expect(shown()).toBe(5);
    });

    // TalkBack needs the actions listed; VoiceOver would read them out in English.
    it.each([
      [PlatformType.ANDROID, [{ name: "increment" }, { name: "decrement" }]],
      [PlatformType.IOS, undefined],
    ])("lists its actions on %s as the reader needs", async (os, actions) => {
      jest.replaceProperty(Platform, "OS", os);
      await render(<Harness start={5} />);

      expect(adjustable().props.accessibilityActions).toEqual(actions);
    });
  });

  describe("press and hold", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockHaptic.mockClear();
    });
    afterEach(() => jest.useRealTimers());

    const pressIn = (id: string) => act(() => fireEvent(part(id), "pressIn"));
    const pressOut = (id: string) => act(() => fireEvent(part(id), "pressOut"));
    const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

    const hold = async (id: string, ms: number) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.longPress(part(id), { duration: ms });
    };

    it("steps once on a tap", async () => {
      await render(<Harness start={5} />);

      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .press(part(STEPPER_PART.INCREMENT));

      expect(shown()).toBe(6);
    });

    // A held button is deliberate after the first second, so it counts faster.
    it("counts faster in its second second than its first", async () => {
      const second = 1000;
      await render(<Harness start={MIN} />);
      await pressIn(STEPPER_PART.INCREMENT);
      const start = shown();

      await wait(second);
      const afterFirst = shown();
      await wait(second);
      await pressOut(STEPPER_PART.INCREMENT);

      expect(shown() - afterFirst).toBeGreaterThan(afterFirst - start);
    });

    it("stops counting when released", async () => {
      await render(<Harness start={MIN} />);
      await hold(STEPPER_PART.INCREMENT, 100);
      const released = shown();

      await wait(2000);

      expect(shown()).toBe(released);
    });

    it("stops counting when the finger slides off the button", async () => {
      const size = 44;
      await render(<Harness start={MIN} />);
      const button = part(STEPPER_PART.INCREMENT);
      await act(() =>
        fireEvent(button, "layout", { nativeEvent: { layout: { width: size, height: size } } })
      );
      await pressIn(STEPPER_PART.INCREMENT);

      await act(() =>
        fireEvent(button, "responderMove", {
          nativeEvent: { locationX: size / 2, locationY: -RETENTION_SLOP - 1 },
        })
      );
      const leftAt = shown();
      await wait(2000);

      expect(shown()).toBe(leftAt);
    });

    it("holds at the floor", async () => {
      await render(<Harness start={MIN + 1} />);

      await hold(STEPPER_PART.DECREMENT, 800);

      expect(shown()).toBe(MIN);
    });

    it("ignores a press while disabled", async () => {
      await render(<Harness start={5} disabled />);

      await hold(STEPPER_PART.INCREMENT, 800);

      expect(shown()).toBe(5);
      expect(mockHaptic).not.toHaveBeenCalled();
    });

    // Disabling mid-hold must stop the count, and re-enabling must not resume it.
    it("stops when disabled mid-hold and stays stopped after release", async () => {
      const { rerender } = await render(<Harness start={5} />);
      await pressIn(STEPPER_PART.INCREMENT);
      await rerender(<Harness start={5} disabled />);
      const disabledAt = shown();

      await wait(800);
      expect(shown()).toBe(disabledAt);

      await pressOut(STEPPER_PART.INCREMENT);
      await rerender(<Harness start={5} />);
      await wait(800);
      expect(shown()).toBe(disabledAt);
    });
  });

  it.each([false, true])(
    "puts decrease before increase in reading order (rtl: %s)",
    async (isRTL) => {
      await render(<Harness start={5} isRTL={isRTL} />);

      const ids = screen
        .getAllByTestId(new RegExp(Object.values(STEPPER_PART).join("|")), {
          includeHiddenElements: true,
        })
        .map((node) => node.props.testID);

      expect(ids).toEqual([STEPPER_PART.DECREMENT, STEPPER_PART.INCREMENT]);
    }
  );
});
