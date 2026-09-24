import { create } from "zustand";

type TabBarFrameState = {
  /** The bar frame's measured height; current only on a tab route. */
  height: number;
  setHeight: (height: number) => void;
};

// For views drawn outside the tabs, e.g. the toast, which cannot read the
// navigator's own height context.
export const useTabBarFrameStore = create<TabBarFrameState>()((set) => ({
  height: 0,
  setHeight: (height) => set({ height }),
}));
