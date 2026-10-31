import { AppState, type AppStateStatus } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { SoundPreview } from "@/components/ui/sound-preview";
import { APP_STATE } from "@/constants/AppState";
import { captureAppState, emitAppState } from "@/test-helpers/appStateMock";
import { renderWithTheme } from "@/test-helpers/theme";
import { soundPreviewManager } from "@/utils/sound";

const mockPlay = jest.fn<Promise<void>, [string | number]>(() => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve());
let mockPlayId: number | undefined;
let mockFinish: ((playId?: number) => void) | null = null;

jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: (source: string | number, playId?: number) => {
    mockPlayId = playId;
    return mockPlay(source);
  },
  stopPreview: () => mockStop(),
  addPreviewListener: (listener: (status: { didJustFinish: boolean; playId?: number }) => void) => {
    // A finish names the latest play unless the test names another.
    mockFinish = (playId = mockPlayId) => listener({ didJustFinish: true, playId });
    return () => {
      mockFinish = null;
    };
  },
}));

const SOURCE = 11;
const OTHER_SOURCE = 12;
const OTHER_OWNER = "elsewhere";
const PLAY = "Hear it";
const STOP = "Stop it";

const CURRENT_STATE = Object.getOwnPropertyDescriptor(AppState, "currentState");

const user = userEvent.setup();
const control = (name: string) => screen.getByRole("button", { name });
const renderPreview = (source: number | null = SOURCE, showLabel = false) =>
  renderWithTheme(
    <SoundPreview source={source} playLabel={PLAY} stopLabel={STOP} showLabel={showLabel} />
  );

beforeEach(() => {
  soundPreviewManager.forceReset();
  mockPlay.mockReset().mockResolvedValue(undefined);
  mockStop.mockClear();
  captureAppState();
  // The preset mocks `currentState` as a function; the app starts in front.
  Object.defineProperty(AppState, "currentState", {
    value: APP_STATE.ACTIVE,
    configurable: true,
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  if (CURRENT_STATE) Object.defineProperty(AppState, "currentState", CURRENT_STATE);
});

it("plays its sound and is named for what a press does", async () => {
  await renderPreview();

  await user.press(control(PLAY));
  expect(mockPlay).toHaveBeenCalledWith(SOURCE);

  await user.press(control(STOP));
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(control(PLAY)).toBeOnTheScreen();
});

it("is disabled with nothing to play", async () => {
  await renderPreview(null);

  await user.press(control(PLAY));

  expect(control(PLAY)).toBeDisabled();
  expect(mockPlay).not.toHaveBeenCalled();
});

it("draws its name only when asked", async () => {
  await renderPreview(SOURCE, true);
  expect(screen.getByText(PLAY)).toBeOnTheScreen();

  await screen.unmount();
  await renderPreview(SOURCE, false);
  expect(screen.queryByText(PLAY)).toBeNull();
});

it("falls back to play when the sound fails to start", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockPlay.mockRejectedValue(new Error("no audio session"));
  await renderPreview();

  await user.press(control(PLAY));

  await waitFor(() => expect(control(PLAY)).toBeOnTheScreen());
});

it("falls back to play when the sound ends", async () => {
  await renderPreview();
  await user.press(control(PLAY));

  await act(async () => mockFinish?.());

  expect(control(PLAY)).toBeOnTheScreen();
});

it("keeps a newer sound playing when an older one ends", async () => {
  await renderPreview();
  await act(() => soundPreviewManager.playSource(OTHER_OWNER, OTHER_SOURCE));
  const olderPlay = mockPlayId;
  await user.press(control(PLAY));

  await act(async () => mockFinish?.(olderPlay));
  expect(control(STOP)).toBeOnTheScreen();

  await act(async () => mockFinish?.());
  expect(control(PLAY)).toBeOnTheScreen();
});

it("stops its own sound when it leaves the screen", async () => {
  await renderPreview();
  await user.press(control(PLAY));

  await screen.unmount();

  await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));
});

it("leaves a sound another control started", async () => {
  await renderPreview();
  await act(() => soundPreviewManager.playSource(OTHER_OWNER, OTHER_SOURCE));

  await screen.unmount();

  expect(mockStop).not.toHaveBeenCalled();
});

it("stops when its sound changes, and does not mark the new one playing", async () => {
  let release = () => {};
  mockStop.mockReturnValueOnce(new Promise<void>((resolve) => (release = resolve)));
  await renderPreview();
  await user.press(control(PLAY));

  await screen.rerender(<SoundPreview source={OTHER_SOURCE} playLabel={PLAY} stopLabel={STOP} />);

  // The old sound still plays until its stop settles; the new source is not it.
  await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));
  expect(control(PLAY)).toBeOnTheScreen();

  await act(async () => release());
  expect(control(PLAY)).toBeOnTheScreen();
});

it("keeps a newer sound playing when an older stop settles", async () => {
  let release = () => {};
  mockStop.mockReturnValueOnce(new Promise<void>((resolve) => (release = resolve)));
  await renderPreview();
  await user.press(control(PLAY));
  await screen.rerender(<SoundPreview source={OTHER_SOURCE} playLabel={PLAY} stopLabel={STOP} />);
  await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));

  await user.press(control(PLAY));
  await act(async () => release());

  expect(mockPlay).toHaveBeenLastCalledWith(OTHER_SOURCE);
  expect(control(STOP)).toBeOnTheScreen();
  await screen.unmount();
  await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(2));
});

it("keeps a newer sound playing when an older one fails to start", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  let fail = (_error: Error) => {};
  mockPlay.mockReturnValueOnce(new Promise<void>((_resolve, reject) => (fail = reject)));
  await renderPreview();
  await user.press(control(PLAY));
  await act(() => soundPreviewManager.playSource(OTHER_OWNER, OTHER_SOURCE));

  await act(async () => fail(new Error("no audio session")));

  expect(soundPreviewManager.getCurrentSound()).toBe(OTHER_OWNER);
});

// A system dialog makes the app inactive; going home backgrounds it.
it.each<AppStateStatus>([APP_STATE.INACTIVE, APP_STATE.BACKGROUND])(
  "stops when the app turns %s",
  async (state) => {
    await renderPreview();
    await user.press(control(PLAY));

    await act(async () => emitAppState(state));

    await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));
  }
);
