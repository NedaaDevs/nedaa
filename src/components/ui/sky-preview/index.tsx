import type { ReactNode } from "react";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { SkyOccluder } from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { VStack } from "@/components/ui/vstack";
import type { SwatchBand } from "@/utils/sky";

/** Test id for the hero's box, which dims the page sky's sun or moon. */
export const SKY_HERO_ID = "sky-hero";

const HERO = { minHeight: 153, edge: 1 } as const;
const SWATCH = { width: 77, height: 58, scale: 0.3 } as const;

type HeroProps = { accessibilityLabel: string; children?: ReactNode };

/** A frame over the page sky, its copy at the foot; read as one element. */
export const SkyHero = ({ accessibilityLabel, children }: HeroProps) => (
  <SkyOccluder testID={SKY_HERO_ID}>
    <VStack
      accessible
      accessibilityLabel={accessibilityLabel}
      minHeight={HERO.minHeight}
      padding="$4"
      justifyContent="flex-end"
      borderWidth={HERO.edge}
      borderColor="$border"
      borderRadius="$sheet">
      {children}
    </VStack>
  </SkyOccluder>
);

type SwatchProps = { bands: readonly SwatchBand[]; hijriDay: number | undefined; isRTL: boolean };

/** A choice's sky drawn small, its bands from the reading start; decorative. */
export const SkySwatch = ({ bands, hijriDay, isRTL }: SwatchProps) => {
  const total = bands.reduce((sum, band) => sum + band.weight, 0);

  return (
    <HStack width={SWATCH.width} height={SWATCH.height} borderRadius="$control" overflow="hidden">
      {bands.map(({ scene, weight, bodies }) => {
        const width = (SWATCH.width * weight) / total;
        return (
          <Box key={scene.key} width={width} height={SWATCH.height}>
            <SkyPaint
              scene={scene}
              celestial={undefined}
              hijriDay={hijriDay}
              isRTL={isRTL}
              reduced
              width={width}
              height={SWATCH.height}
              scale={SWATCH.scale}
              bodies={bodies}
              testID={SKY_PART.PREVIEW}
            />
          </Box>
        );
      })}
    </HStack>
  );
};
