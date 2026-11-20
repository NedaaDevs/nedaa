import { create } from "zustand";

type TabBarFrameState = {
  /** The bar frame's measured height; current only on a tab route. */
  height: number;
  setHeight: (height: number) => void;
  /** How many screens hold the bar's pill hidden. */
  covers: number;
  /** Hides the pill until the returned lift is called; a lift counts once. */
  cover: () => () => void;
};

// For views drawn outside the tabs, e.g. the toast, which cannot read the
// navigator's own height context.
export const useTabBarFrameStore = create<TabBarFrameState>()((set) => ({
  height: 0,
  setHeight: (height) => set({ height }),
  covers: 0,
  cover: () => {
    let lifted = false;
    set((state) => ({ covers: state.covers + 1 }));
    return () => {
      if (lifted) return;
      lifted = true;
      set((state) => ({ covers: state.covers - 1 }));
    };
  },
}));
