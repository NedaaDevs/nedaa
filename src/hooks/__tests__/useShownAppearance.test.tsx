import type { ReactNode } from "react";
import type { ColorSchemeName } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { NATIVE_SCHEME } from "@/constants/Appearance";
import { BRIGHTNESS } from "@/constants/Palette";
import { PHASE, type Phase } from "@/constants/Phase";
import { AppMode } from "@/enums/app";
import { useShownAppearance } from "@/hooks/useShownAppearance";
import { PHASE_BRIGHTNESS } from "@/utils/phase";

type Inputs = { mode: AppMode; phase: Phase | undefined; scheme: ColorSchemeName | null };

/** Each change the hook hands over, held until the test lets it run. */
let held: (() => void)[] = [];
const transition = jest.fn((fn: () => void) => {
  held.push(fn);
  return Promise.resolve();
});
const runHeld = () =>
  act(() => {
    held.splice(0).forEach((fn) => fn());
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeTransitionContext value={transition}>{children}</ThemeTransitionContext>
);

const renderShown = (initial: Inputs) =>
  renderHook(({ mode, phase, scheme }: Inputs) => useShownAppearance(mode, phase, scheme), {
    initialProps: initial,
    wrapper,
  });

const phasesOf = (brightness: string) =>
  Object.values(PHASE).filter((phase) => PHASE_BRIGHTNESS[phase] === brightness);
const [LIGHT_PHASE, OTHER_LIGHT_PHASE] = phasesOf(BRIGHTNESS.LIGHT);
const [DARK_PHASE] = phasesOf(BRIGHTNESS.DARK);

describe("useShownAppearance", () => {
  beforeEach(() => {
    held = [];
    transition.mockClear();
  });

  it("shows the inputs it starts with", async () => {
    const { result } = await renderShown({
      mode: AppMode.ADAPTIVE,
      phase: LIGHT_PHASE,
      scheme: NATIVE_SCHEME.LIGHT,
    });

    expect(result.current).toEqual({ phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT });
  });

  it("dissolves an Adaptive phase change that flips light to dark", async () => {
    const start = { mode: AppMode.ADAPTIVE, phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT };
    const { result, rerender } = await renderShown(start);

    await rerender({ ...start, phase: DARK_PHASE });

    expect(transition).toHaveBeenCalledTimes(1);
    // The old phase holds until the snapshot covers the screen.
    expect(result.current.phase).toBe(LIGHT_PHASE);

    await runHeld();
    expect(result.current.phase).toBe(DARK_PHASE);
  });

  it("shows a phase change that keeps the brightness at once", async () => {
    const start = { mode: AppMode.ADAPTIVE, phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT };
    const { result, rerender } = await renderShown(start);

    await rerender({ ...start, phase: OTHER_LIGHT_PHASE });

    expect(transition).not.toHaveBeenCalled();
    expect(result.current.phase).toBe(OTHER_LIGHT_PHASE);
  });

  it("dissolves the phone's scheme flipping under System", async () => {
    const start = { mode: AppMode.SYSTEM, phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT };
    const { result, rerender } = await renderShown(start);

    await rerender({ ...start, scheme: NATIVE_SCHEME.DARK });

    expect(transition).toHaveBeenCalledTimes(1);
    expect(result.current.scheme).toBe(NATIVE_SCHEME.LIGHT);

    await runHeld();
    expect(result.current.scheme).toBe(NATIVE_SCHEME.DARK);
  });

  it("ignores the phone's scheme under a fixed mode", async () => {
    const start = { mode: AppMode.LIGHT, phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT };
    const { result, rerender } = await renderShown(start);

    await rerender({ ...start, scheme: NATIVE_SCHEME.DARK });

    expect(transition).not.toHaveBeenCalled();
    expect(result.current.scheme).toBe(NATIVE_SCHEME.DARK);
  });

  it("shows the newest inputs when a held change runs late", async () => {
    const start = { mode: AppMode.ADAPTIVE, phase: LIGHT_PHASE, scheme: NATIVE_SCHEME.LIGHT };
    const { result, rerender } = await renderShown(start);

    await rerender({ ...start, phase: DARK_PHASE });
    await rerender({ ...start, phase: PHASE.NIGHT, scheme: NATIVE_SCHEME.DARK });
    await runHeld();

    expect(result.current).toEqual({ phase: PHASE.NIGHT, scheme: NATIVE_SCHEME.DARK });
  });
});
