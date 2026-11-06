import { Text } from "react-native";
import { screen, waitFor } from "@testing-library/react-native";

import AyahImage from "@/components/quran/AyahImage";
import { AppDirection } from "@/enums/app";
import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { type HostElement, styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";
import type { GlyphBound } from "@/types/quran";

jest.mock("@/services/quran-content-db", () => ({
  QuranContentDB: { getGlyphBounds: jest.fn() },
}));
jest.mock("@/services/quran-download", () => ({
  QuranDownload: { getImageType: () => jest.requireActual("@/enums/quran").MushafImageType.LINE },
}));

/** One word, inset from the line's left; a mirrored crop shows other words. */
const WORD: GlyphBound = {
  page: 42,
  line: 3,
  position: 1,
  surahNumber: 2,
  ayahNumber: 255,
  wordIndex: 1,
  x: 300,
  y: 0,
  width: 400,
  height: 200,
  isMarker: false,
};
const MAX_WIDTH = 320;
const FALLBACK = "fallback";
// The host type React Native renders an Image as.
const HOST_IMAGE = "Image";

const hostsOfType = (element: HostElement, type: string): HostElement[] => [
  ...(element.type === type ? [element] : []),
  ...element.children
    .filter((child): child is HostElement => typeof child !== "string")
    .flatMap((child) => hostsOfType(child, type)),
];

describe("AyahImage", () => {
  beforeEach(() => jest.mocked(QuranContentDB.getGlyphBounds).mockResolvedValue([WORD]));

  // Each line is a window on the line image, offset from its left edge.
  it.each(PHONE_APP_PAIRS)(
    "crops the ayah's own words on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await renderWithTheme(
        <AyahImage
          version={MushafVersion.V1}
          page={WORD.page}
          surah={WORD.surahNumber}
          ayah={WORD.ayahNumber}
          quranTheme={QuranTheme.SEPIA}
          maxWidth={MAX_WIDTH}
          fallback={<Text>{FALLBACK}</Text>}
        />,
        { isRTL: app === AppDirection.RTL }
      );
      await waitFor(() => expect(screen.queryByText(FALLBACK)).toBeNull());
      const root = screen.root;
      if (!root) throw new Error("AyahImage rendered nothing");
      const [image] = hostsOfType(root, HOST_IMAGE);
      const segment = image.parent;
      if (!segment) throw new Error("the line image sits in no crop");

      const [, drawn] = await layOutSpans(
        {
          style: onPhone(styleOf(segment), phone),
          children: [{ style: onPhone(styleOf(image), phone) }],
        },
        app
      );

      // Yoga rounds a layout to whole points.
      expect(drawn.left).toBeCloseTo(Number(styleOf(image).left), 0);
    }
  );
});
