import { create } from "zustand";

type ToastType = "success" | "error" | "warning" | "info" | "muted";

interface ToastState {
  message: string;
  title?: string;
  type: ToastType;
  isVisible: boolean;
  showToast: (message: string, type: ToastType, title?: string, duration?: number) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  title: "",
  type: "muted",
  duration: 3000,
  isVisible: false,
  showToast: (message, type, title, duration) => {
    set({ message, type, title, isVisible: true });
    setTimeout(() => {
      set({ isVisible: false });
    }, duration);
  },
  hideToast: () => set({ isVisible: false }),
}));
