import { AppState, AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useAppVisibility } from "@/hooks/useAppVisibility";

type Listener = (state: AppStateStatus) => void;

describe("useAppVisibility", () => {
  let listeners: Listener[];
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    listeners = [];
    let t = 1000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => ++t);
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      const l = handler as Listener;
      listeners.push(l);
      return { remove: () => listeners.splice(listeners.indexOf(l), 1) } as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  });

  afterEach(() => {
    nowSpy.mockRestore();
    (AppState.addEventListener as jest.Mock).mockRestore();
  });

  // Reaches whoever is subscribed now; the hook may resubscribe between acts.
  const emit = (state: AppStateStatus) => [...listeners].forEach((l) => l(state));

  it("records a foreground return when events arrive in separate batches", async () => {
    const { result } = await renderHook(() => useAppVisibility());
    const initial = result.current.becameActiveAt;

    await act(() => emit("background"));
    await act(() => emit("active"));

    expect(result.current.isActive).toBe(true);
    expect(result.current.becameActiveAt).toBeGreaterThan(initial);
  });

  it("records a foreground return when background->active arrive in one batch", async () => {
    // Both events' state updates land in one render pass, as on a quick
    // system-dialog dismiss or a queued event burst on resume.
    const { result } = await renderHook(() => useAppVisibility());
    const initial = result.current.becameActiveAt;

    await act(() => {
      emit("background");
      emit("active");
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.becameActiveAt).toBeGreaterThan(initial);
  });
});
