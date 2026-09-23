import { Alert, Platform } from "react-native";
import { useState } from "react";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";

import { HOLD, HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { RETENTION_SLOP } from "@/components/ui/pressable/retention";
import { PlatformType } from "@/enums/app";
import { ThemeProvider } from "@/test-helpers/theme";

// The fill is reanimated, which cannot load under jest; it is drawing only.
jest.mock("@/components/ui/hold-to-confirm/Fill", () => ({ Fill: () => null }));

const mockHaptics = { warning: jest.fn(), light: jest.fn() };
jest.mock("@/hooks/useHaptic", () => ({
  useHaptic: (type: keyof typeof mockHaptics) => mockHaptics[type],
}));

const LABEL = "Reset all data";
const DIALOG = {
  title: "Reset all qada data",
  message: "This cannot be undone.",
  confirmLabel: "Reset",
  cancelLabel: "Cancel",
};

const renderHold = (props: Partial<Parameters<typeof HoldToConfirm>[0]> = {}) => {
  const onConfirm = jest.fn();
  const ui = (extra: Partial<Parameters<typeof HoldToConfirm>[0]> = {}) => (
    <ThemeProvider>
      <HoldToConfirm
        label={LABEL}
        onConfirm={onConfirm}
        screenReaderConfirm={DIALOG}
        {...props}
        {...extra}
      />
    </ThemeProvider>
  );
  const view = render(ui());
  return { onConfirm, view, ui };
};

const control = () => screen.getByRole("button", { name: LABEL });

describe("HoldToConfirm", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.values(mockHaptics).forEach((haptic) => haptic.mockClear());
  });
  afterEach(() => jest.useRealTimers());

  const hold = (ms: number) =>
    userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).longPress(control(), {
      duration: ms,
    });

  describe("holding", () => {
    it("confirms once the hold runs its full length", async () => {
      const { onConfirm, view } = renderHold();
      await view;

      await hold(HOLD.DEFAULT_MS + HOLD.TICK_MS / 10);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("does nothing when let go early", async () => {
      const { onConfirm, view } = renderHold();
      await view;

      await hold(HOLD.DEFAULT_MS - HOLD.TICK_MS);
      await act(() => jest.advanceTimersByTime(HOLD.DEFAULT_MS * 2));

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("takes the hold length it is given", async () => {
      const short = HOLD.TICK_MS * 2;
      const { onConfirm, view } = renderHold({ durationMs: short });
      await view;

      await hold(short + HOLD.TICK_MS / 10);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    // A warning on touch, then a tick at every interval, so the hand feels time pass.
    it("ticks while held", async () => {
      const { view } = renderHold();
      await view;

      await hold(HOLD.TICK_MS * 3 + HOLD.TICK_MS / 2);

      expect(mockHaptics.warning).toHaveBeenCalledTimes(1);
      expect(mockHaptics.light).toHaveBeenCalledTimes(3);
    });

    it("stops ticking when let go", async () => {
      const { view } = renderHold();
      await view;
      await hold(HOLD.TICK_MS + HOLD.TICK_MS / 2);
      const ticks = mockHaptics.light.mock.calls.length;

      await act(() => jest.advanceTimersByTime(HOLD.TICK_MS * 4));

      expect(mockHaptics.light).toHaveBeenCalledTimes(ticks);
    });

    it("ignores a hold while busy", async () => {
      const { onConfirm, view } = renderHold({ busy: true });
      await view;

      await hold(HOLD.DEFAULT_MS * 2);

      expect(onConfirm).not.toHaveBeenCalled();
      expect(control()).toBeBusy();
    });

    it("stops ticking at confirm though the finger stays down", async () => {
      const { onConfirm, view } = renderHold();
      await view;

      await hold(HOLD.DEFAULT_MS + HOLD.TICK_MS * 4);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(mockHaptics.light.mock.calls.length).toBeLessThanOrEqual(
        HOLD.DEFAULT_MS / HOLD.TICK_MS
      );
    });

    // The screen runs its work busy after confirm, as the Qada reset does.
    it("confirms once though the finger stays down through the busy spell", async () => {
      const onConfirm = jest.fn();
      const BusyAfterConfirm = () => {
        const [busy, setBusy] = useState(false);
        return (
          <ThemeProvider>
            <HoldToConfirm
              label={LABEL}
              busy={busy}
              screenReaderConfirm={DIALOG}
              onConfirm={() => {
                onConfirm();
                setBusy(true);
                setTimeout(() => setBusy(false), HOLD.TICK_MS);
              }}
            />
          </ThemeProvider>
        );
      };
      await render(<BusyAfterConfirm />);
      await act(() => fireEvent(control(), "pressIn"));

      await act(() => jest.advanceTimersByTime(HOLD.DEFAULT_MS + 1));
      await act(() => jest.advanceTimersByTime(HOLD.TICK_MS + 1));
      await act(() => jest.advanceTimersByTime(HOLD.DEFAULT_MS * 2));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    describe("sliding off", () => {
      const FRAME = { width: 300, height: 44 };
      // The control sits at this page offset; the finger lands at its middle.
      const AT = { x: 40, y: 400 };
      const holdThenMoveTo = async (move: { pageX: number; locationX: number }) => {
        await act(() => fireEvent(control(), "layout", { nativeEvent: { layout: FRAME } }));
        await act(() =>
          fireEvent(control(), "responderGrant", {
            nativeEvent: {
              pageX: AT.x + FRAME.width / 2,
              pageY: AT.y + FRAME.height / 2,
              locationX: FRAME.width / 2,
              locationY: FRAME.height / 2,
            },
          })
        );
        await act(() => fireEvent(control(), "pressIn"));
        await act(() =>
          fireEvent(control(), "responderMove", {
            nativeEvent: { ...move, pageY: AT.y + FRAME.height / 2, locationY: FRAME.height / 2 },
          })
        );
        await act(() => jest.advanceTimersByTime(HOLD.DEFAULT_MS * 2));
      };

      // Sliding away is how a finger takes back a press.
      it("lets go of the hold past the edge", async () => {
        const { onConfirm, view } = renderHold();
        await view;
        const pageX = AT.x + FRAME.width + RETENTION_SLOP + 1;

        await holdThenMoveTo({ pageX, locationX: pageX - AT.x });

        expect(onConfirm).not.toHaveBeenCalled();
      });

      // Android reads a move against the view under the finger, so its locationX is near zero.
      it("lets go past the edge when the move reports another view", async () => {
        const { onConfirm, view } = renderHold();
        await view;

        await holdThenMoveTo({ pageX: AT.x + FRAME.width + RETENTION_SLOP + 1, locationX: 2 });

        expect(onConfirm).not.toHaveBeenCalled();
      });

      it("keeps the hold through a small drift", async () => {
        const { onConfirm, view } = renderHold();
        await view;
        const pageX = AT.x + FRAME.width + RETENTION_SLOP - 1;

        await holdThenMoveTo({ pageX, locationX: pageX - AT.x });

        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    it("cancels a hold when it turns busy", async () => {
      const { onConfirm, view, ui } = renderHold();
      const { rerender } = await view;
      await act(() => fireEvent(control(), "pressIn"));

      await rerender(ui({ busy: true }));
      await act(() => jest.advanceTimersByTime(HOLD.DEFAULT_MS * 2));

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  // A screen reader takes the touch, so the hold would never start.
  describe("screen reader", () => {
    const activate = () =>
      act(() =>
        fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "activate" } })
      );
    const tap = () => act(() => fireEvent(control(), "accessibilityTap"));
    const dialogButtons = () => jest.mocked(Alert.alert).mock.lastCall?.[2] ?? [];
    const dialogButton = (text: string) => {
      const button = dialogButtons().find((candidate) => candidate.text === text);
      if (!button?.onPress) throw new Error(`no "${text}" button in the dialog`);
      return button;
    };

    beforeEach(() => jest.spyOn(Alert, "alert").mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    // VoiceOver sends a double-tap as an accessibility tap; TalkBack as the action.
    it.each([
      ["a VoiceOver double-tap", tap],
      ["a TalkBack double-tap", activate],
    ])("asks in a dialog on %s", async (_, doubleTap) => {
      const { view } = renderHold();
      await view;

      await doubleTap();

      expect(Alert.alert).toHaveBeenCalledWith(DIALOG.title, DIALOG.message, [
        expect.objectContaining({ text: DIALOG.cancelLabel, style: "cancel" }),
        expect.objectContaining({ text: DIALOG.confirmLabel, style: "destructive" }),
      ]);
    });

    it("confirms from the dialog", async () => {
      const { onConfirm, view } = renderHold();
      await view;
      await tap();

      await act(() => dialogButton(DIALOG.confirmLabel).onPress!());

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the dialog is cancelled", async () => {
      const { onConfirm, view } = renderHold();
      await view;
      await tap();

      await act(() =>
        dialogButtons()
          .find((b) => b.text === DIALOG.cancelLabel)
          ?.onPress?.()
      );

      expect(dialogButtons().find((b) => b.text === DIALOG.cancelLabel)).toMatchObject({
        style: "cancel",
      });
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it.each([
      ["a VoiceOver double-tap", tap],
      ["a TalkBack double-tap", activate],
    ])("opens no dialog while busy on %s", async (_, doubleTap) => {
      const { view } = renderHold({ busy: true });
      await view;

      await doubleTap();

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it.each([
      [PlatformType.ANDROID, [{ name: "activate" }]],
      [PlatformType.IOS, undefined],
    ])("lists its action on %s as the reader needs", async (os, actions) => {
      jest.replaceProperty(Platform, "OS", os);
      const { view } = renderHold();
      await view;

      expect(control().props.accessibilityActions).toEqual(actions);
    });
  });
});
