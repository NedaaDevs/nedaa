import { createContext, use } from "react";

import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";
import { usePreferencesStore } from "@/stores/preferences";

/** A fixed multiplier for the texts below it, in place of the app preset. */
export const TextScaleContext = createContext<number | null>(null);

/** Font multiplier of the nearest TextScaleContext, else the app's preset. */
export const useTextScale = (): number => {
  const preset = TEXT_SIZE_MULTIPLIERS[usePreferencesStore((s) => s.textSize)];
  return use(TextScaleContext) ?? preset;
};

/** Whether text here draws larger than the Default preset. */
export const useEnlargedText = (): boolean =>
  useTextScale() > TEXT_SIZE_MULTIPLIERS[TextSize.DEFAULT];
