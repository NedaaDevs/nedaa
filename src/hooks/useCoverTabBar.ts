import { useEffect } from "react";

import { useTabBarFrameStore } from "@/stores/tabBarFrame";

/** Hides the tab bar's pill while `active`, for a screen that puts its own bar there. */
export const useCoverTabBar = (active: boolean) => {
  useEffect(() => {
    if (active) return useTabBarFrameStore.getState().cover();
  }, [active]);
};
