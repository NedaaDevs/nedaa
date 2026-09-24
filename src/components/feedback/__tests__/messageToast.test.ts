import { NetworkStatusBanner } from "@/components/feedback/NetworkStatusBanner";
import { MessageToast } from "@/components/feedback/MessageToast";
import { TOAST_KIND } from "@/constants/Toast";
import i18n from "@/localization/i18n";
import { useToastStore } from "@/stores/toast";

const shown = () => useToastStore.getState().toast;

describe("MessageToast", () => {
  beforeEach(() => useToastStore.setState({ toast: null }));

  it.each([
    ["showSuccess", TOAST_KIND.SUCCESS],
    ["showInfo", TOAST_KIND.INFO],
    ["showProgress", TOAST_KIND.PROGRESS],
    ["showWarning", TOAST_KIND.WARNING],
    ["showError", TOAST_KIND.ERROR],
  ] as const)("%s shows a %s toast with the message alone", (method, kind) => {
    MessageToast[method]("Link copied");

    expect(shown()).toMatchObject({ kind, message: "Link copied" });
    expect(shown()).not.toHaveProperty("title");
  });

  it("carries one action to redo the operation", () => {
    const retry = { label: "Retry", onPress: jest.fn() };
    MessageToast.showError("Couldn't update", { action: retry });

    expect(shown()!.action).toBe(retry);
  });

  it("hides what shows", () => {
    MessageToast.showSuccess("Link copied");
    MessageToast.hide();

    expect(shown()).toBeNull();
  });
});

describe("NetworkStatusBanner", () => {
  beforeEach(() => useToastStore.setState({ toast: null }));

  it.each([
    ["showOffline", TOAST_KIND.ERROR, "network.messages.offline"],
    ["showSlow", TOAST_KIND.WARNING, "network.messages.slow"],
    ["showError", TOAST_KIND.ERROR, "network.messages.error"],
  ] as const)("%s shows a %s toast through MessageToast", (method, kind, fallback) => {
    NetworkStatusBanner[method]();

    expect(shown()).toMatchObject({ kind, message: i18n.t(fallback) });
  });

  it("prefers the caller's message", () => {
    NetworkStatusBanner.showOffline("Unable to connect to server");

    expect(shown()!.message).toBe("Unable to connect to server");
  });
});
