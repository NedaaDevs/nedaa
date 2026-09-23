import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SkyBackground } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PHASE } from "@/constants/Phase";
import { PhaseContext, usePhase } from "@/contexts/PhaseContext";

/** How long each simulated phase holds: long enough to watch a crossfade. */
export const SIMULATED_PHASE_MS = 3000;

export const SKY_DEBUG_PART = { PHASE: "sky-debug-phase" } as const;

/** Shown in place of a phase while the sky follows the real clock. */
export const LIVE_LABEL = "live";

const DAY = Object.values(PHASE);

const SkyDebugScreen = () => {
  const livePhase = usePhase();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (step === null) return;
    const timer = setTimeout(
      () => setStep(step + 1 < DAY.length ? step + 1 : null),
      SIMULATED_PHASE_MS
    );
    return () => clearTimeout(timer);
  }, [step]);

  const simulated = step === null ? undefined : DAY[step];

  return (
    <PhaseContext value={simulated ?? livePhase}>
      <SkyBackground>
        <ScreenHeader title="Sky Debug" back />
        <VStack flex={1} justifyContent="flex-end" gap="$3" padding="$4" paddingBottom="$8">
          <Text testID={SKY_DEBUG_PART.PHASE} size="xl" bold>
            {simulated ?? LIVE_LABEL}
          </Text>
          <Text size="sm">Day and night swap only when Appearance is Adaptive.</Text>
          <Button
            onPress={() => setStep(0)}
            disabled={step !== null}
            accessibilityRole="button"
            accessibilityLabel="Simulate a day">
            <Button.Text>Simulate a day</Button.Text>
          </Button>
        </VStack>
      </SkyBackground>
    </PhaseContext>
  );
};

export default SkyDebugScreen;
