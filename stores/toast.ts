import { create } from "zustand";

type ToastOptions = {
  variant?: "solid" | "outline";
  action?: "error" | "warning" | "success" | "info" | "muted";
  placement?:
    | "top"
    | "bottom"
    | "top right"
    | "top left"
    | "bottom left"
    | "bottom right";
  duration?: number;
  description?: string;
};

type ToastState = {
  message: string;
  options: ToastOptions;
  showToast: (message: string, options?: ToastOptions) => void;
  hideToast: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  options: {},
  showToast: (message, options = {}) =>
    set({
      message,
      options: {
        variant: "solid",
        action: "muted",
        placement: "top",
        duration: 3000,
        ...options,
      },
    }),
  hideToast: () => set({ message: "", options: {} }),
}));
