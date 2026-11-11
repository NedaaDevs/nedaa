import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import { QURAN_SEEK_PART, QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { AppDirection } from "@/enums/app";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/services/quran-audio/quranAudioPlayer", () => ({
  quranAudioPlayer: { seekTo: jest.fn(), setListenMode: jest.fn() },
}));
jest.mock("@/services/quran-audio/quranReciterRegistry", () => ({
  quranReciterRegistry: { reciterOf: () => Promise.resolve(null), localizedName: () => "" },
}));

// A quarter of the way in, so the fill and the thumb both sit off the edges.
const DURATION = 120;
const PROGRESS = 0.25;
const TRACK_WIDTH = 300;

const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe("QuranMiniPlayer seek bar", () => {
  beforeEach(() =>
    useQuranAudioStore.setState({
      playerState: QURAN_PLAYER_STATE.PAUSED,
      duration: DURATION,
      position: DURATION * PROGRESS,
      positionUpdatedAt: 0,
    })
  );

  it.each(PHONE_APP_PAIRS)(
    "centres the thumb on the fill's moving edge on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await renderWithTheme(<QuranMiniPlayer />, { isRTL: app === AppDirection.RTL });

      // The track holds the fill and the thumb.
      const [, fill, thumb] = await layOutSpans(
        {
          style: { width: TRACK_WIDTH },
          children: [
            { style: onPhone(styleOf(QURAN_SEEK_PART.FILL), phone) },
            { style: onPhone(styleOf(QURAN_SEEK_PART.THUMB), phone) },
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
