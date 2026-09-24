import { TOAST_KIND } from "@/constants/Toast";
import { useToastStore } from "@/stores/toast";

const show = (message: string) =>
  useToastStore.getState().show({ kind: TOAST_KIND.SUCCESS, message });
const current = () => useToastStore.getState().toast;

describe("toast store", () => {
  beforeEach(() => useToastStore.setState({ toast: null }));

  it("holds one toast; a new one replaces it under a new id", () => {
    show("Link copied");
    const first = current()!.id;
    show("Report sent");

    expect(current()!.message).toBe("Report sent");
    expect(current()!.id).not.toBe(first);
  });

  it("hides the toast it was asked to hide", () => {
    show("Link copied");
    useToastStore.getState().hide(current()!.id);

    expect(current()).toBeNull();
  });

  // A dwell timer that outlives its toast must not cut the next one short.
  it("ignores a hide meant for a toast already replaced", () => {
    show("Refreshing widgets…");
    const stale = current()!.id;
    show("Widgets updated");
    useToastStore.getState().hide(stale);

    expect(current()!.message).toBe("Widgets updated");
  });

  it("hides whatever shows when no id is given", () => {
    show("Link copied");
    useToastStore.getState().hide();

    expect(current()).toBeNull();
  });
});
