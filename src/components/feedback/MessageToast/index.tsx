import { TOAST_KIND, type ToastKind } from "@/constants/Toast";
import { useToastStore } from "@/stores/toast";
import type { ToastContent } from "@/utils/toast";

type Options = Pick<ToastContent, "action" | "durationMs">;

const shower =
  (kind: ToastKind) =>
  (message: string, options: Options = {}) =>
    useToastStore.getState().show({ kind, message, ...options });

/** The one way to show a toast. A new toast replaces the one on screen. */
export const MessageToast = {
  showSuccess: shower(TOAST_KIND.SUCCESS),
  showInfo: shower(TOAST_KIND.INFO),
  showProgress: shower(TOAST_KIND.PROGRESS),
  showWarning: shower(TOAST_KIND.WARNING),
  showError: shower(TOAST_KIND.ERROR),
  hide: () => useToastStore.getState().hide(),
};

export default MessageToast;
