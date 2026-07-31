import { create } from "zustand";

type ToastType = "success" | "error" | "warning" | "info" | "muted";

type ToastState = {
  message: string;
  title?: string;
  type: ToastType;
  isVisible: boolean;
  showToast: (message: string, type: ToastType, title?: string, duration?: number) => void;
  hideToast: () => void;
};

// One toast surface, so one pending dismissal. Held outside the store because it
// is scheduling state, not rendered state.
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPendingHide = () => {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
};

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  title: "",
  type: "muted",
  isVisible: false,
  // Callers that omit a duration get the standard dwell time; without the default
  // the timeout fires on the next tick and the toast never renders a visible frame.
  showToast: (message, type, title, duration = 3000) => {
    // The previous message's dismissal would otherwise cut this one short.
    cancelPendingHide();
    set({ message, type, title, isVisible: true });
    hideTimer = setTimeout(() => {
      hideTimer = null;
      set({ isVisible: false });
    }, duration);
  },
  hideToast: () => {
    cancelPendingHide();
    set({ isVisible: false });
  },
}));
