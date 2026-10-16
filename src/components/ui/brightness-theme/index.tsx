import type { ReactNode } from "react";
import { Theme } from "tamagui";

import { AppMode } from "@/enums/app";

/** Draws its subtree in the light or the dark theme, whatever the app's is. */
export const BrightnessTheme = ({ dark, children }: { dark: boolean; children: ReactNode }) => (
  <Theme name={dark ? AppMode.DARK : AppMode.LIGHT}>{children}</Theme>
);
