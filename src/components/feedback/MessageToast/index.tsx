import { useToastStore } from "@/stores/toast";
import i18n from "@/localization/i18n";

type ToastType = "success" | "error" | "warning" | "info" | "muted";

type Options = {
  message: string;
  type?: ToastType;
  title?: string;
  duration?: number;
};

const show = ({ message, type = "info", title, duration = 3000 }: Options) => {
  const { showToast } = useToastStore.getState();
  showToast(message, type, title, duration);
};

const showSuccess = (message: string, title?: string, duration?: number) => {
  show({
    message,
    type: "success",
    title: title || i18n.t("common.success"),
    duration,
  });
};

const showError = (message: string, title?: string, duration?: number) => {
  show({
    message,
    type: "error",
    title: title || i18n.t("common.error"),
    duration: duration || 5000,
  });
};

const showWarning = (message: string, title?: string, duration?: number) => {
  show({
    message,
    type: "warning",
    title: title || i18n.t("common.warning"),
    duration,
  });
};

const showInfo = (message: string, title?: string, duration?: number) => {
  show({
    message,
    type: "info",
    title,
    duration,
  });
};

const hide = () => {
  const { hideToast } = useToastStore.getState();
  hideToast();
};

export const MessageToast = {
  show,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  hide,
};

export default MessageToast;
