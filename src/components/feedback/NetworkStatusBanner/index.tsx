import { useToastStore } from "@/stores/toast";
import i18n from "@/localization/i18n";
import { Props } from "./types";
type Status = "online" | "offline" | "slow" | "error";

const getToastConfig = (status: Status, customMessage?: string, retryCountdown?: number) => {
  const countdownText = retryCountdown ? ` Retrying in ${retryCountdown}s...` : "";

  switch (status) {
    case "online":
      return {
        toastType: "success" as const,
        title: i18n.t("network.connected"),
        toastMessage: customMessage || i18n.t("network.messages.online"),
      };

    case "offline":
      return {
        toastType: "error" as const,
        title: i18n.t("network.noConnection"),
        toastMessage: (customMessage || i18n.t("network.messages.offline")) + countdownText,
      };

    case "slow":
      return {
        toastType: "warning" as const,
        title: i18n.t("network.slowConnection"),
        toastMessage: (customMessage || i18n.t("network.messages.slow")) + countdownText,
      };

    case "error":
      return {
        toastType: "error" as const,
        title: i18n.t("network.connectionError"),
        toastMessage: (customMessage || i18n.t("network.messages.error")) + countdownText,
      };

    default:
      return {
        toastType: "muted" as const,
        title: i18n.t("network.connected"),
        toastMessage: customMessage || i18n.t("network.messages.online"),
      };
  }
};

const show = ({
  status,
  message,
  retryCountdown,
  duration = 4000,
}: {
  status: Status;
  message?: string;
  retryCountdown?: number;
  duration?: number;
}) => {
  const { showToast } = useToastStore.getState();
  const { toastType, toastMessage, title } = getToastConfig(status, message, retryCountdown);
  showToast(toastMessage, toastType, title, duration);
};

const showOffline = (message?: string) => {
  show({
    status: "offline",
    message: message || i18n.t("network.messages.offline"),
    duration: 5000,
  });
};

const showOnline = (message?: string) => {
  show({
    status: "online",
    message: message || i18n.t("network.messages.online"),
    duration: 3000,
  });
};

const showSlow = (message?: string) => {
  show({
    status: "slow",
    message: message || i18n.t("network.messages.slow"),
    duration: 4000,
  });
};

const showError = (message?: string, retryCountdown?: number) => {
  show({
    status: "error",
    message: message || i18n.t("network.messages.error"),
    retryCountdown,
    duration: 6000,
  });
};

const hide = () => {
  const { hideToast } = useToastStore.getState();
  hideToast();
};

export const NetworkStatusBanner = {
  show,
  showOffline,
  showOnline,
  showSlow,
  showError,
  hide,
};

export default NetworkStatusBanner;
