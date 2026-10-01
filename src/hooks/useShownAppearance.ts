import { useEffect, useRef, useState } from "react";
import type { ColorSchemeName } from "react-native";

import { useThemeTransition } from "@/components/ui/theme-transition/context";
import type { Phase } from "@/constants/Phase";
import type { AppMode } from "@/enums/app";
import { isDarkMode } from "@/utils/appearance";

export type AppearanceInputs = {
  phase: Phase | undefined;
  scheme: ColorSchemeName | null | undefined;
};

/** The phase and scheme drawn; a light/dark flip waits for a dissolve. */
export const useShownAppearance = (
  mode: AppMode,
  phase: Phase | undefined,
  scheme: ColorSchemeName | null | undefined
): AppearanceInputs => {
  const withThemeTransition = useThemeTransition();
  const [shown, setShown] = useState<AppearanceInputs>(() => ({ phase, scheme }));
  // A dissolve runs its change later; it shows the inputs of that moment.
  const latest = useRef<AppearanceInputs>({ phase, scheme });

  const flips = isDarkMode(mode, scheme, phase) !== isDarkMode(mode, shown.scheme, shown.phase);
  if (!flips && (phase !== shown.phase || scheme !== shown.scheme)) {
    setShown({ phase, scheme });
  }

  useEffect(() => {
    latest.current = { phase, scheme };
  }, [phase, scheme]);

  useEffect(() => {
    if (!flips) return;
    void withThemeTransition(() => setShown(latest.current));
  }, [flips, phase, scheme, withThemeTransition]);

  return shown;
};
