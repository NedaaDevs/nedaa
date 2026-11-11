import { useLayoutEffect } from "react";

import type { StepPrimary, StepProps } from "@/components/onboarding/flow/types";

/** Hands the step's primary to the frame before paint; repeats are dropped. */
export const useStepPrimary = (
  setPrimary: StepProps["setPrimary"],
  primary: StepPrimary | null
) => {
  useLayoutEffect(() => {
    setPrimary(primary);
  });
};
