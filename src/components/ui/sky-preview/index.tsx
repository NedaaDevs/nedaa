import type { ReactNode } from "react";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { SkyOccluder } from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { VStack } from "@/components/ui/vstack";
import { SKY_SWATCH_SIZE, type SkySwatchSize } from "@/constants/Sky";
import type { SwatchBand } from "@/utils/sky";

/** Test id for the hero's box, which dims the page sky's sun or moon. */
export const SKY_HERO_ID = "sky-hero";
/** Test id for a swatch's frame. */
export const SKY_SWATCH_ID = "sky-swatch";

const HERO = { minHeight: 153, edge: 1 } as const;

const SWATCH = {
  [SKY_SWATCH_SIZE.CHOICE]: { width: 77, height: 58, radius: "$control" },
  [SKY_SWATCH_SIZE.BUTTON]: { width: 44, height: 30, radius: "$chip" },
  [SKY_SWATCH_SIZE.CARD]: { width: 52, height: 40, radius: "$chip" },
} as const satisfies Record<SkySwatchSize, { width: number; height: number; radius: string }>;
/** The sky every size shrinks into its frame: a choice's, at 0.3. */
const PAINTED_WIDTH = SWATCH[SKY_SWATCH_SIZE.CHOICE].width / 0.3;

type HeroProps = {
  accessibilityLabel: string;
  /** Drops the frame's height, for one short line with nothing above it. */
  compact?: boolean;
  children?: ReactNode;
};

/** A frame over the page sky, its copy at the foot; read as one element. */
export const SkyHero = ({ accessibilityLabel, compact = false, children }: HeroProps) => (
  <SkyOccluder testID={SKY_HERO_ID}>
    <VStack
      accessible
      accessibilityLabel={accessibilityLabel}
      minHeight={compact ? undefined : HERO.minHeight}
      padding="$4"
      justifyContent="flex-end"
      borderWidth={HERO.edge}
      borderColor="$border"
      borderRadius="$sheet">
      {children}
    </VStack>
  </SkyOccluder>
);

type SwatchProps = {
  bands: readonly SwatchBand[];
  hijriDay: number | undefined;
  isRTL: boolean;
  size?: SkySwatchSize;
};

/** A choice's sky drawn small, its bands from the reading start; decorative. */
export const SkySwatch = ({
  bands,
  hijriDay,
  isRTL,
  size = SKY_SWATCH_SIZE.CHOICE,
}: SwatchProps) => {
  const frame = SWATCH[size];
  const total = bands.reduce((sum, band) => sum + band.weight, 0);

  return (
    <HStack
      testID={SKY_SWATCH_ID}
      width={frame.width}
      height={frame.height}
      borderRadius={frame.radius}
      overflow="hidden">
      {bands.map(({ scene, weight, bodies }) => {
        const width = (frame.width * weight) / total;
        return (
          <Box key={scene.key} width={width} height={frame.height}>
            <SkyPaint
              scene={scene}
              celestial={undefined}
              hijriDay={hijriDay}
              isRTL={isRTL}
              reduced
              width={width}
              height={frame.height}
              scale={frame.width / PAINTED_WIDTH}
              bodies={bodies}
              testID={SKY_PART.PREVIEW}
            />
          </Box>
        );
      })}
    </HStack>
  );
};
