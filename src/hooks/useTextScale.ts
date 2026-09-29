import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";
import { usePreferencesStore } from "@/stores/preferences";

/** Font multiplier of the active in-app text-size preset. */
export const useTextScale = (): number =>
  TEXT_SIZE_MULTIPLIERS[usePreferencesStore((s) => s.textSize)];

/** Whether the largest preset is on; rows stack their parts there. */
export const useLargestText = (): boolean =>
  usePreferencesStore((s) => s.textSize) === TextSize.MAX;
