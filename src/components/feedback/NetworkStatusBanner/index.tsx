import { MessageToast } from "@/components/feedback/MessageToast";
import i18n from "@/localization/i18n";

/** Network failures from the API layer, reported as toasts. */
export const NetworkStatusBanner = {
  showOffline: (message?: string) =>
    MessageToast.showError(message ?? i18n.t("network.messages.offline")),
  showSlow: (message?: string) =>
    MessageToast.showWarning(message ?? i18n.t("network.messages.slow")),
  showError: (message?: string) =>
    MessageToast.showError(message ?? i18n.t("network.messages.error")),
};

export default NetworkStatusBanner;
