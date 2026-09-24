import { create } from "zustand";

import type { ToastContent } from "@/utils/toast";

export type ShownToast = ToastContent & { id: number };

type ToastState = {
  toast: ShownToast | null;
  show: (toast: ToastContent) => void;
  /** Hides the toast with this id, or whatever shows when none is given. */
  hide: (id?: number) => void;
};

let nextId = 1;

// Read through MessageToast and the host only; callers never touch it.
export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  show: (toast) => set({ toast: { ...toast, id: nextId++ } }),
  hide: (id) =>
    set((state) => (id === undefined || state.toast?.id === id ? { toast: null } : state)),
}));
