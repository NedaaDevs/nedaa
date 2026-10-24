import { StyleSheet } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { act, fireEvent, screen } from "@testing-library/react-native";

import AudioControls, {
  AUDIO_SEEK_GESTURE,
  AUDIO_SEEK_PART,
} from "@/components/athkar/AudioControls";
import { AppDirection } from "@/enums/app";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/services/athkar-player", () => ({
  athkarPlayer: { seekTo: jest.fn(), setPlaybackRate: jest.fn() },
}));

// A quarter of the way in, so the fill and the thumb both sit off the edges.
const DURATION = 120;
const PROGRESS = 0.25;

jest.mock("@/stores/athkar", () => ({
  useAthkarStore: (select: (state: object) => unknown) =>
    select({ repeatProgress: { current: 1, total: 1 } }),
}));
jest.mock("@/stores/athkar-audio", () => ({
  useAthkarAudioStore: (select: (state: object) => unknown) =>
    select({
      duration: DURATION,
      position: DURATION * PROGRESS,
      comfortMode: false,
      playbackRate: jest.requireActual("@/constants/AthkarAudio").DEFAULT_PLAYBACK_RATE,
    }),
}));

const TRACK_WIDTH = 300;
const hidden = { includeHiddenElements: true } as const;
/** A part's style as Yoga receives it on a phone read in `phone`. */
const styleOf = (testID: string, phone: AppDirection) =>
  onPhone(StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style), phone);

/** Seeks to PROGRESS, measured from the reading start of the track. */
const seekTo = async (app: AppDirection) => {
  await renderWithTheme(
    <AudioControls
      onPlayPause={jest.fn()}
      onNext={jest.fn()}
      onPrevious={jest.fn()}
      onCollapse={jest.fn()}
      onDismiss={jest.fn()}
    />,
    { isRTL: app === AppDirection.RTL }
  );
  await act(() =>
    fireEvent(screen.getByTestId(AUDIO_SEEK_PART.TOUCH, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: TRACK_WIDTH, height: 44 } },
    })
  );
  const fromStart = TRACK_WIDTH * PROGRESS;
  const x = app === AppDirection.RTL ? TRACK_WIDTH - fromStart : fromStart;
  await act(() =>
    fireGestureHandler(getByGestureTestId(AUDIO_SEEK_GESTURE.PAN), [
      { state: State.BEGAN, x },
      { state: State.ACTIVE, x },
      { state: State.END, x },
    ])
  );
};

describe("AudioControls seek bar", () => {
  it.each(PHONE_APP_PAIRS)(
    "centres the thumb on the fill's moving edge on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await seekTo(app);

      // The touch view holds the track, which holds the fill, and the thumb.
      const [, , fill, thumb] = await layOutSpans(
        {
          style: { width: TRACK_WIDTH },
          children: [
            { style: {}, children: [{ style: styleOf(AUDIO_SEEK_PART.FILL, phone) }] },
            { style: styleOf(AUDIO_SEEK_PART.THUMB, phone) },
          ],
        },
        app
      );

      const movingEdge = app === AppDirection.RTL ? fill.left : fill.left + fill.width;
      expect(fill.width).toBeCloseTo(TRACK_WIDTH * PROGRESS);
      expect(thumb.left + thumb.width / 2).toBeCloseTo(movingEdge);
    }
  );
});
