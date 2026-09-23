import { Text } from "react-native";
import { act, screen } from "@testing-library/react-native";

import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { DURATION_MS } from "@/constants/Motion";
import { BRIGHTNESS } from "@/constants/Palette";
import { PHASE, type Phase } from "@/constants/Phase";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { renderWithTheme } from "@/test-helpers/theme";
import { skyScene } from "@/utils/sky";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const Sky = ({ phase }: { phase: Phase | undefined }) => (
  <PhaseContext value={phase}>
    <SkyBackground>
      <Text>Today</Text>
    </SkyBackground>
  </PhaseContext>
);

const part = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });

type PaintStyle = { backgroundColor: string; experimental_backgroundImage: string };

/** Each painted sky, back to front. */
const paints = (): PaintStyle[] =>
  part(SKY_PART.PAINT).map((node) => Object.assign({}, ...[node.props.style].flat(Infinity)));

const underlays = () => paints().map((paint) => paint.backgroundColor);

describe("SkyBackground", () => {
  beforeEach(() => {
    mockReduced = false;
    useAppStore.setState({ mode: AppMode.LIGHT });
  });

  it("draws its children over a sky the screen reader skips", async () => {
    await renderWithTheme(<Sky phase={PHASE.DAY} />);

    expect(screen.getByText("Today")).toBeOnTheScreen();
    expect(screen.queryByTestId(SKY_PART.CANVAS)).toBeNull();
    expect(part(SKY_PART.CANVAS)).toHaveLength(1);
  });

  it.each([
    [AppMode.LIGHT, PHASE.ASR, BRIGHTNESS.LIGHT],
    [AppMode.DARK, PHASE.MAGHRIB, BRIGHTNESS.DARK],
  ])("in %s at %s paints that scene", async (mode, phase, brightness) => {
    useAppStore.setState({ mode });
    await renderWithTheme(<Sky phase={phase} />);
    const scene = skyScene(brightness, phase);

    expect(paints()[0].backgroundColor).toBe(scene.underlay);
    expect(paints()[0].experimental_backgroundImage).toContain(scene.base.stops[1].color);
  });

  it.each([
    [false, "linear-gradient(90deg"],
    [true, "linear-gradient(270deg"],
  ])("turns the edge wash to the reading start (rtl: %s)", async (isRTL, wash) => {
    await renderWithTheme(<Sky phase={PHASE.DAY} />, { isRTL });

    expect(paints()[0].experimental_backgroundImage.startsWith(wash)).toBe(true);
  });

  it("keeps one sky when a phase change paints the same one", async () => {
    const { rerender } = await renderWithTheme(<Sky phase={PHASE.DAY} />);

    await rerender(<Sky phase={PHASE.NIGHT} />);

    expect(part(SKY_PART.PAINT)).toHaveLength(1);
  });

  it("swaps the sky at once under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Sky phase={PHASE.DAY} />);

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(underlays()).toEqual([skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay]);
  });

  describe("crossfade", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("holds the old sky under the new one while it fades in", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);

      await act(() => useAppStore.setState({ mode: AppMode.DARK }));

      expect(underlays()).toEqual([
        skyScene(BRIGHTNESS.LIGHT, PHASE.DAY).underlay,
        skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay,
      ]);
    });

    it("drops the old sky once the fade ends", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);
      await act(() => useAppStore.setState({ mode: AppMode.DARK }));

      await act(() => jest.advanceTimersByTime(DURATION_MS.SKY + 100));

      expect(underlays()).toEqual([skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay]);
    });
  });
});
