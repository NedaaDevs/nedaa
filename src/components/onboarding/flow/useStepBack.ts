import { useEffectEvent, useLayoutEffect } from "react";

import type { StepProps } from "@/components/onboarding/flow/types";

/** Hands every back to `handler` before paint; unmounting gives it back. */
export const useStepBack = (setBack: StepProps["setBack"], handler: (() => void) | null) => {
  useLayoutEffect(() => {
    setBack(handler);
  });
  const release = useEffectEvent(() => setBack(null));
  useLayoutEffect(() => () => release(), []);
};
