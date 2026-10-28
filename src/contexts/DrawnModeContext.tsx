import { createContext, use } from "react";

import type { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";

/** The mode a day run draws in place of the chosen one; null when none does. */
export const DrawnModeContext = createContext<AppMode | null>(null);

/** The mode the app draws: a run's, else the one the user chose. */
export const useDrawnMode = (): AppMode => {
  const mode = useAppStore((state) => state.mode);
  return use(DrawnModeContext) ?? mode;
};
