import { userEvent } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

import SkyDebugScreen, {
  LIVE_LABEL,
  SIMULATED_PHASE_MS,
  SKY_DEBUG_PART,
} from "@/app/settings/sky-debug";
import { SKY_PART } from "@/components/ui/sky-background";
import { DEBUG_ROUTE } from "@/constants/DebugRoutes";
import { PHASE_GRADIENTS } from "@/constants/Palette";
import { PHASE } from "@/constants/Phase";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";

const renderScreen = () =>
  renderRouter(
    { [DEBUG_ROUTE.SKY.slice(1)]: SkyDebugScreen },
    {
      initialUrl: DEBUG_ROUTE.SKY,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const shownPhase = () => screen.getByTestId(SKY_DEBUG_PART.PHASE).props.children;

const paintedSky = () =>
  Object.assign(
    {},
    ...[
      screen.getAllByTestId(SKY_PART.PAINT, { includeHiddenElements: true }).at(-1)!.props.style,
    ].flat(Infinity)
  ).experimental_backgroundImage as string;

const simulate = async () =>
  userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .press(screen.getByText("Simulate a day"));

describe("sky debug", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAppStore.setState({ mode: AppMode.LIGHT });
  });
  afterEach(() => jest.useRealTimers());

  it("shows the live phase until a day is simulated", async () => {
    await renderScreen();

    expect(shownPhase()).toBe(LIVE_LABEL);
  });

  it("walks the sky through every phase in order, then returns to live", async () => {
    await renderScreen();
    await simulate();

    const seen = [shownPhase()];
    for (let step = 1; step <= Object.values(PHASE).length; step += 1) {
      await act(() => jest.advanceTimersByTime(SIMULATED_PHASE_MS));
      seen.push(shownPhase());
    }

    expect(seen).toEqual([...Object.values(PHASE), LIVE_LABEL]);
  });

  it("paints the simulated phase's sky", async () => {
    await renderScreen();
    await simulate();

    while (shownPhase() !== PHASE.ASR) {
      await act(() => jest.advanceTimersByTime(SIMULATED_PHASE_MS));
    }

    expect(paintedSky()).toContain(PHASE_GRADIENTS[PHASE.ASR].light!.to);
  });
});
