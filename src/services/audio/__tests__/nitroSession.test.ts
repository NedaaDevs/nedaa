import { nitroSession } from "@/services/audio/nitroSession";

jest.mock("react-native-nitro-player", () => ({
  TrackPlayer: {
    configure: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    onChangeTrack: jest.fn(),
    onPlaybackStateChange: jest.fn(),
    onPlaybackProgressChange: jest.fn(),
  },
  PlayerQueue: {},
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

describe("nitroSession ownership", () => {
  beforeEach(() => nitroSession.__resetForTest());

  it("acquiring awaits the previous owner's teardown before handing over", async () => {
    const evicted: string[] = [];
    // Async teardown that resolves on a later microtask; ownership must not flip
    // to quran until it completes.
    const athkarEvict = jest.fn(async () => {
      await Promise.resolve();
      evicted.push("athkar");
    });
    const quranEvict = jest.fn();
    nitroSession.register("athkar", { onEvict: athkarEvict });
    nitroSession.register("quran", { onEvict: quranEvict });

    await nitroSession.acquire("athkar");
    expect(nitroSession.owns("athkar")).toBe(true);

    await nitroSession.acquire("quran");
    expect(athkarEvict).toHaveBeenCalledTimes(1);
    expect(evicted).toEqual(["athkar"]);
    expect(nitroSession.owns("quran")).toBe(true);
    expect(nitroSession.owns("athkar")).toBe(false);
  });

  it("re-acquiring by the same owner does not evict", async () => {
    const athkarEvict = jest.fn();
    nitroSession.register("athkar", { onEvict: athkarEvict });
    await nitroSession.acquire("athkar");
    await nitroSession.acquire("athkar");
    expect(athkarEvict).not.toHaveBeenCalled();
  });

  it("release clears ownership only for the current owner", async () => {
    nitroSession.register("athkar", {});
    await nitroSession.acquire("athkar");
    nitroSession.release("quran");
    expect(nitroSession.owns("athkar")).toBe(true);
    nitroSession.release("athkar");
    expect(nitroSession.current()).toBeNull();
  });

  it("preview can acquire ownership and evict the previous owner", async () => {
    const athkarEvict = jest.fn();
    nitroSession.register("athkar", { onEvict: athkarEvict });
    nitroSession.register("preview", {});

    await nitroSession.acquire("athkar");
    await nitroSession.acquire("preview");

    expect(athkarEvict).toHaveBeenCalledTimes(1);
    expect(nitroSession.owns("preview")).toBe(true);
  });

  it("reset removes the preview handler", async () => {
    const previewEvict = jest.fn();
    nitroSession.register("preview", { onEvict: previewEvict });
    await nitroSession.acquire("preview");

    nitroSession.__resetForTest();
    await nitroSession.acquire("preview");
    await nitroSession.acquire("quran");

    expect(previewEvict).not.toHaveBeenCalled();
  });
});
