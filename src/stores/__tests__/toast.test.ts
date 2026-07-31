import { useToastStore } from "@/stores/toast";

describe("toast store", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.setState({ message: "", title: "", type: "muted", isVisible: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("stays visible when the caller omits a duration", () => {
    useToastStore.getState().showToast("Widgets updated", "success");

    expect(useToastStore.getState().isVisible).toBe(true);

    // Without a default the timeout would fire here and the toast would never render.
    jest.advanceTimersByTime(0);
    expect(useToastStore.getState().isVisible).toBe(true);

    jest.advanceTimersByTime(3000);
    expect(useToastStore.getState().isVisible).toBe(false);
  });

  test("honours an explicit duration", () => {
    useToastStore.getState().showToast("Saved", "success", undefined, 500);

    jest.advanceTimersByTime(499);
    expect(useToastStore.getState().isVisible).toBe(true);

    jest.advanceTimersByTime(1);
    expect(useToastStore.getState().isVisible).toBe(false);
  });

  test("hideToast dismisses immediately", () => {
    useToastStore.getState().showToast("Saved", "success");
    useToastStore.getState().hideToast();

    expect(useToastStore.getState().isVisible).toBe(false);
  });

  test("a replacing toast is not cut short by the previous one's dismissal", () => {
    useToastStore.getState().showToast("Refreshing widgets", "muted", undefined, 10_000);

    jest.advanceTimersByTime(1000);
    useToastStore.getState().showToast("Widgets updated", "success");

    // The first toast's 10s timer must not survive to dismiss this one.
    jest.advanceTimersByTime(2999);
    expect(useToastStore.getState().isVisible).toBe(true);
    expect(useToastStore.getState().message).toBe("Widgets updated");

    jest.advanceTimersByTime(1);
    expect(useToastStore.getState().isVisible).toBe(false);
  });
});
