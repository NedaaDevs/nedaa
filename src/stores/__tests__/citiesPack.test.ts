import { useCitiesPackStore } from "@/stores/citiesPack";
import { downloadCitiesPack } from "@/services/cities-download";
import { isFullPackInstalled, invalidateCitiesDb } from "@/services/cities-db";

jest.mock("@/services/cities-download", () => ({
  downloadCitiesPack: jest.fn(),
}));

jest.mock("@/services/cities-db", () => ({
  isFullPackInstalled: jest.fn(() => false),
  invalidateCitiesDb: jest.fn(),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

const mockDownload = downloadCitiesPack as jest.Mock;
const mockIsInstalled = isFullPackInstalled as jest.Mock;

describe("cities pack store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInstalled.mockReturnValue(false);
    useCitiesPackStore.setState({
      isInstalled: false,
      isDownloading: false,
      receivedBytes: 0,
      totalBytes: 0,
      error: null,
    });
  });

  test("refreshInstalled reads the installed state from disk", () => {
    mockIsInstalled.mockReturnValue(true);
    useCitiesPackStore.getState().refreshInstalled();
    expect(useCitiesPackStore.getState().isInstalled).toBe(true);
  });

  test("download marks installed and drops the open connection on success", async () => {
    mockDownload.mockResolvedValueOnce(undefined);
    mockIsInstalled.mockReturnValue(true);

    await useCitiesPackStore.getState().download();

    expect(invalidateCitiesDb).toHaveBeenCalled();
    expect(useCitiesPackStore.getState().isInstalled).toBe(true);
    expect(useCitiesPackStore.getState().isDownloading).toBe(false);
  });

  test("download records the error and stays uninstalled on failure", async () => {
    mockDownload.mockRejectedValueOnce(new Error("offline"));

    await useCitiesPackStore.getState().download();

    expect(useCitiesPackStore.getState().error).toBe("offline");
    expect(useCitiesPackStore.getState().isInstalled).toBe(false);
    expect(useCitiesPackStore.getState().isDownloading).toBe(false);
  });

  test("a failed download leaves the connection alone, so the seed stays usable", async () => {
    mockDownload.mockRejectedValueOnce(new Error("offline"));

    await useCitiesPackStore.getState().download();

    expect(invalidateCitiesDb).not.toHaveBeenCalled();
  });

  test("download reports progress bytes as they arrive", async () => {
    mockDownload.mockImplementationOnce(
      async ({ onProgress }: { onProgress: (p: unknown) => void }) => {
        onProgress({ receivedBytes: 1000, totalBytes: 6_073_000 });
      }
    );

    await useCitiesPackStore.getState().download();

    expect(useCitiesPackStore.getState().receivedBytes).toBe(1000);
    expect(useCitiesPackStore.getState().totalBytes).toBe(6_073_000);
  });

  test("a previous error is cleared when a new download starts", async () => {
    useCitiesPackStore.setState({ error: "offline" });
    mockDownload.mockResolvedValueOnce(undefined);

    await useCitiesPackStore.getState().download();

    expect(useCitiesPackStore.getState().error).toBeNull();
  });

  test("a second download call while one is running is ignored", async () => {
    mockDownload.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve as () => void, 10))
    );

    const first = useCitiesPackStore.getState().download();
    await useCitiesPackStore.getState().download();
    await first;

    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  test("cancel aborts the in-flight download via the signal", async () => {
    let seenSignal: AbortSignal | undefined;
    mockDownload.mockImplementationOnce(async ({ signal }: { signal: AbortSignal }) => {
      seenSignal = signal;
      await new Promise((resolve) => setTimeout(resolve as () => void, 5));
    });

    const pending = useCitiesPackStore.getState().download();
    useCitiesPackStore.getState().cancel();
    await pending;

    expect(seenSignal?.aborted).toBe(true);
    expect(useCitiesPackStore.getState().isDownloading).toBe(false);
  });

  // The aborted task rejects; a cancel is the user's choice, not a failure.
  test("a cancelled download records no error", async () => {
    mockDownload.mockImplementationOnce(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted")))
        )
    );

    const pending = useCitiesPackStore.getState().download();
    useCitiesPackStore.getState().cancel();
    await pending;

    expect(useCitiesPackStore.getState().error).toBeNull();
    expect(useCitiesPackStore.getState().isDownloading).toBe(false);
  });

  test("a download begun after a cancel can still be cancelled", async () => {
    const settleFirst: { reject?: (error: Error) => void } = {};
    const signals: AbortSignal[] = [];
    mockDownload
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise((_, reject) => {
          settleFirst.reject = reject;
        });
      })
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted")))
        );
      });

    const first = useCitiesPackStore.getState().download();
    useCitiesPackStore.getState().cancel();
    const second = useCitiesPackStore.getState().download();
    settleFirst.reject?.(new Error("aborted"));
    await first;
    useCitiesPackStore.getState().cancel();
    await second;

    expect(signals[1]?.aborted).toBe(true);
  });

  // A native progress event can cross the bridge after its task was aborted.
  test("a cancelled download's late progress leaves a newer download's meter", async () => {
    type Progress = (progress: { receivedBytes: number; totalBytes: number }) => void;
    const firstProgress: { report?: Progress } = {};
    const abortable = ({ signal }: { signal: AbortSignal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted")))
      );
    mockDownload
      .mockImplementationOnce((options: { signal: AbortSignal; onProgress: Progress }) => {
        firstProgress.report = options.onProgress;
        return abortable(options);
      })
      .mockImplementationOnce(abortable);

    const first = useCitiesPackStore.getState().download();
    useCitiesPackStore.getState().cancel();
    await first;
    const second = useCitiesPackStore.getState().download();
    firstProgress.report?.({ receivedBytes: 5, totalBytes: 10 });

    expect(useCitiesPackStore.getState()).toMatchObject({ receivedBytes: 0, totalBytes: 0 });
    useCitiesPackStore.getState().cancel();
    await second;
  });

  // A cancel can land after the install; the newer download keeps the flag.
  it("a cancelled download that installed leaves a newer download running", async () => {
    const finishFirst: { resolve?: () => void } = {};
    mockDownload
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst.resolve = resolve)))
      .mockImplementationOnce(() => new Promise(() => {}));

    const first = useCitiesPackStore.getState().download();
    useCitiesPackStore.getState().cancel();
    void useCitiesPackStore.getState().download();
    mockIsInstalled.mockReturnValue(true);
    finishFirst.resolve?.();
    await first;

    expect(useCitiesPackStore.getState()).toMatchObject({ isDownloading: true, isInstalled: true });
  });
});
