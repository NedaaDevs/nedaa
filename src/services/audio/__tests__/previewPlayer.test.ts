import type { NitroHandlers } from "@/services/audio/nitroSession";

const mockTrackPlayer = {
  pause: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  playSong: jest.fn().mockResolvedValue(undefined),
  setRepeatMode: jest.fn().mockResolvedValue(undefined),
};

const mockPlayerQueue = {
  createPlaylist: jest.fn().mockResolvedValue("preview-playlist"),
  addTracksToPlaylist: jest.fn().mockResolvedValue(undefined),
  loadPlaylist: jest.fn().mockResolvedValue(undefined),
  deletePlaylist: jest.fn().mockResolvedValue(undefined),
};

let mockOwner: string | null = null;
let mockHandlers: NitroHandlers = {};
const mockNitroSession = {
  register: jest.fn((_owner: string, handlers: NitroHandlers) => {
    mockHandlers = handlers;
  }),
  ensureStarted: jest.fn().mockResolvedValue(undefined),
  acquire: jest.fn(async (owner: string) => {
    mockOwner = owner;
  }),
  release: jest.fn((owner: string) => {
    if (mockOwner === owner) mockOwner = null;
  }),
  owns: jest.fn((owner: string) => mockOwner === owner),
};

const mockAssetFromModule = jest.fn();

jest.mock("react-native-nitro-player", () => ({
  TrackPlayer: mockTrackPlayer,
  PlayerQueue: mockPlayerQueue,
}));

jest.mock("expo-asset", () => ({
  Asset: { fromModule: mockAssetFromModule },
}));

jest.mock("@/services/audio/nitroSession", () => ({
  NITRO_STATE: {
    PLAYING: "playing",
    PAUSED: "paused",
    STOPPED: "stopped",
    BUFFERING: "buffering",
  },
  NITRO_REASON: {
    USER_ACTION: "user_action",
    SKIP: "skip",
    END: "end",
    ERROR: "error",
    REPEAT: "repeat",
  },
  nitroSession: mockNitroSession,
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

type PreviewPlayerModule = typeof import("@/services/audio/previewPlayer");

// CommonJS keeps the module load after Jest registers the native dependency mocks.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const previewPlayer = require("@/services/audio/previewPlayer") as PreviewPlayerModule;

const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe("previewPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwner = null;
    mockTrackPlayer.pause.mockResolvedValue(undefined);
    mockTrackPlayer.play.mockResolvedValue(undefined);
    mockTrackPlayer.playSong.mockResolvedValue(undefined);
    mockTrackPlayer.setRepeatMode.mockResolvedValue(undefined);
    mockPlayerQueue.createPlaylist.mockResolvedValue("preview-playlist");
    mockPlayerQueue.addTracksToPlaylist.mockResolvedValue(undefined);
    mockPlayerQueue.loadPlaylist.mockResolvedValue(undefined);
    mockPlayerQueue.deletePlaylist.mockResolvedValue(undefined);
    mockNitroSession.ensureStarted.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await previewPlayer.stopPreview();
  });

  it("extracts a bundled Metro asset and loads its local URI into Nitro", async () => {
    const downloadedAsset = {
      localUri: "file:///cache/makkah_athan1.mp3",
      uri: "asset:///makkah_athan1.mp3",
    };
    const asset = {
      localUri: null as string | null,
      uri: "asset:///makkah_athan1.mp3",
      downloadAsync: jest.fn().mockResolvedValue(downloadedAsset),
    };
    mockAssetFromModule.mockReturnValue(asset);

    await previewPlayer.playPreview(42);

    expect(mockAssetFromModule).toHaveBeenCalledWith(42);
    expect(asset.downloadAsync).toHaveBeenCalledTimes(1);
    expect(mockNitroSession.acquire).toHaveBeenCalledWith("preview");
    expect(mockPlayerQueue.addTracksToPlaylist).toHaveBeenCalledWith("preview-playlist", [
      expect.objectContaining({
        id: "preview-track",
        url: "file:///cache/makkah_athan1.mp3",
      }),
    ]);
    expect(mockTrackPlayer.playSong).toHaveBeenCalledWith("preview-track", "preview-playlist");
    expect(mockTrackPlayer.play).toHaveBeenCalledTimes(1);
  });

  it("passes a custom sound URI directly to Nitro", async () => {
    await previewPlayer.playPreview("content://sounds/custom.mp3");

    expect(mockAssetFromModule).not.toHaveBeenCalled();
    expect(mockPlayerQueue.addTracksToPlaylist).toHaveBeenCalledWith("preview-playlist", [
      expect.objectContaining({ url: "content://sounds/custom.mp3" }),
    ]);
  });

  it("ignores stale end and progress events until the current preview reaches PLAYING", async () => {
    const listener = jest.fn();
    const unsubscribe = previewPlayer.addPreviewListener(listener);
    await previewPlayer.playPreview("https://example.com/preview.mp3");

    mockHandlers.onProgress?.(9, 10, false);
    mockHandlers.onPlaybackStateChange?.("stopped", "end");

    expect(listener).not.toHaveBeenCalled();
    expect(mockPlayerQueue.deletePlaylist).not.toHaveBeenCalled();
    expect(mockNitroSession.release).not.toHaveBeenCalled();

    mockHandlers.onPlaybackStateChange?.("playing");
    listener.mockClear();
    mockHandlers.onProgress?.(2, 8, false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({
      playing: true,
      didJustFinish: false,
      currentTime: 2,
      duration: 8,
    });
    unsubscribe();
  });

  it("emits natural completion once as an edge and tears down the preview owner", async () => {
    const listener = jest.fn();
    const unsubscribe = previewPlayer.addPreviewListener(listener);
    await previewPlayer.playPreview("https://example.com/preview.mp3");
    mockHandlers.onPlaybackStateChange?.("playing");
    mockHandlers.onProgress?.(7, 7, false);
    listener.mockClear();

    mockHandlers.onPlaybackStateChange?.("stopped", "end");
    mockHandlers.onPlaybackStateChange?.("stopped", "end");
    await flushPromises();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      playing: false,
      didJustFinish: true,
      currentTime: 7,
      duration: 7,
    });
    expect(mockPlayerQueue.deletePlaylist).toHaveBeenCalledWith("preview-playlist");
    expect(mockNitroSession.release).toHaveBeenCalledWith("preview");
    unsubscribe();
  });

  it("stops and releases only the preview-owned player", async () => {
    await previewPlayer.playPreview("https://example.com/preview.mp3");

    await previewPlayer.stopPreview();

    expect(mockTrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayerQueue.deletePlaylist).toHaveBeenCalledWith("preview-playlist");
    expect(mockNitroSession.release).toHaveBeenCalledWith("preview");

    mockOwner = "quran";
    mockTrackPlayer.pause.mockClear();
    await previewPlayer.stopPreview();
    expect(mockTrackPlayer.pause).not.toHaveBeenCalled();
  });

  it("deletes its playlist when another Nitro owner evicts it", async () => {
    await previewPlayer.playPreview("https://example.com/preview.mp3");

    await mockHandlers.onEvict?.();

    expect(mockPlayerQueue.deletePlaylist).toHaveBeenCalledWith("preview-playlist");
    expect(mockNitroSession.release).toHaveBeenCalledWith("preview");
  });
});
