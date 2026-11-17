import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import { Box } from "@/components/ui/box";
import { SkyBackground } from "@/components/ui/sky-background";
import { ClaimSkyBodies } from "@/components/ui/sky-background/bodies";
import { useElevationShadow } from "@/components/ui/material/edge";
import type { AthkarLookId } from "@/constants/AthkarLook";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { SAMPLE_SESSION, still } from "@/utils/athkarSampleSession";

/** Test ids for the preview's parts. */
export const LOOK_PREVIEW_PART = {
  ROOT: "look-preview",
  PICTURE: "look-picture",
  STAGE: "look-picture-stage",
} as const;

/** The reader's size in the design, and the share of it a picture keeps. */
export const LOOK_PICTURE = { WIDTH: 324, HEIGHT: 720, SCALE: 0.1 } as const;

type LookPreviewProps = { look: AthkarLookId };

/** A look's reader over the sample session: seen, never read or pressed. */
export const LookPreview = ({ look }: LookPreviewProps) => {
  const { Reader, drawsSun } = ATHKAR_LOOKS[look];
  return (
    <Box
      testID={LOOK_PREVIEW_PART.ROOT}
      flex={1}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {drawsSun ? <ClaimSkyBodies /> : null}
      <Reader
        session={SAMPLE_SESSION}
        onOpenList={still}
        onOpenFocus={still}
        onStartAudio={still}
        trying
      />
    </Box>
  );
};

const { WIDTH, HEIGHT, SCALE } = LOOK_PICTURE;

/** A small picture of a look, for a row that names it. */
export const LookPicture = ({ look }: LookPreviewProps) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  return (
    <Box
      testID={LOOK_PREVIEW_PART.PICTURE}
      width={WIDTH * SCALE}
      height={HEIGHT * SCALE}
      overflow="hidden"
      borderRadius="$chip"
      style={{ boxShadow: lift }}>
      {/* Centred on the frame, so the scale needs no origin and no direction. */}
      <Box
        testID={LOOK_PREVIEW_PART.STAGE}
        position="absolute"
        top={(HEIGHT * (SCALE - 1)) / 2}
        left={(WIDTH * (SCALE - 1)) / 2}
        width={WIDTH}
        height={HEIGHT}
        style={{ transform: [{ scale: SCALE }] }}>
        <SkyBackground paused>
          <LookPreview look={look} />
        </SkyBackground>
      </Box>
    </Box>
  );
};
