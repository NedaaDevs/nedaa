import { use } from "react";
import { Platform } from "react-native";

import { UnderStatusBarContext } from "@/contexts/UnderStatusBarContext";
import { PlatformType } from "@/enums/app";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";
import { statusBarEdgeFade, statusBarFade, type StatusBarFade } from "@/utils/sky";

/** How content fades under the status bar; null below a padded top. */
export const useStatusBarFade = (): StatusBarFade | null => {
  const insetTop = use(UnderStatusBarContext);
  const reduceTransparency = useReduceTransparency();
  if (insetTop === null) return null;
  return Platform.OS === PlatformType.ANDROID
    ? statusBarEdgeFade(insetTop)
    : statusBarFade({ insetTop, reduceTransparency });
};
