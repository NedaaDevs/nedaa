import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { usePreferencesStore } from "@/stores/preferences";

/** Font multiplier of the active in-app text-size preset. */
export const useTextScale = (): number =>
  TEXT_SIZE_MULTIPLIERS[usePreferencesStore((s) => s.textSize)];
