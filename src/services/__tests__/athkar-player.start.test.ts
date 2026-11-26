jest.mock("react-native-nitro-player", () => ({
  TrackPlayer: {
    pause: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    playSong: jest.fn(async () => {}),
    setRepeatMode: jest.fn(async () => {}),
    setPlaybackSpeed: jest.fn(async () => {}),
  },
  PlayerQueue: {
    createPlaylist: jest.fn(async () => "playlist"),
    addTracksToPlaylist: jest.fn(async () => {}),
    loadPlaylist: jest.fn(async () => {}),
    deletePlaylist: jest.fn(async () => {}),
  },
}));
jest.mock("@/services/audio/nitroSession", () => ({
  nitroSession: {
    register: jest.fn(),
    ensureStarted: jest.fn(async () => {}),
    acquire: jest.fn(async () => {}),
    release: jest.fn(),
  },
}));
jest.mock("@/services/athkar-audio-download", () => ({
  audioDownloadManager: { getLocalPath: jest.fn(async () => null) },
}));
jest.mock("@/services/athkar-reciter-registry", () => ({
  reciterRegistry: {
    fetchManifest: jest.fn(async () => ({ files: {} })),
    getCachedCatalog: jest.fn(() => null),
  },
  getLocalizedName: jest.fn(),
}));
jest.mock("@/stores/athkar-audio", () => ({
  useAthkarAudioStore: {
    getState: () => ({
      selectedReciterId: "reciter",
      setPosition: jest.fn(),
      setDuration: jest.fn(),
    }),
  },
}));
jest.mock("@/utils/nowPlayingArtwork", () => ({ resolveNowPlayingArtwork: jest.fn() }));
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/athkar-db", () => ({ AthkarDB: {} }));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn(), d: jest.fn() }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { athkarPlayer } from "@/services/athkar-player";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
/* eslint-enable import/first */

const ID = "1";
const PLAYLIST = "playlist";
/** An order no audio map holds, so the dhikr's file is keyed by its id. */
const UNMAPPED_ORDER = 9999;
const state = () => useAthkarStore.getState();

/** A session of one dhikr whose reciter has its file. */
const withOneDhikr = () => {
  useAthkarStore.setState({
    morningAthkarList: [
      { id: ID, title: "", text: "", count: 3, type: ATHKAR_TYPE.MORNING, order: UNMAPPED_ORDER },
    ],
  });
  jest.mocked(reciterRegistry.fetchManifest).mockResolvedValue({
    id: "reciter",
    version: 1,
    type: "clips",
    files: { [ID]: { url: "u", duration: 1, size: 1 } },
  });
};

beforeEach(() => {
  useAthkarStore.setState({
    currentType: ATHKAR_TYPE.MORNING,
    morningAthkarList: [],
    playerState: PLAYER_STATE.IDLE,
    loadingAthkarId: null,
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("starting audio on a dhikr", () => {
  test("a queue that fails to build leaves the player idle, with no dhikr loading", async () => {
    jest.spyOn(athkarPlayer, "buildQueue").mockRejectedValue(new Error("no queue"));
    await expect(athkarPlayer.startAndJumpTo(ID)).resolves.toBeUndefined();
    expect(state().playerState).toBe(PLAYER_STATE.IDLE);
    expect(state().loadingAthkarId).toBeNull();
  });

  test("a start after a failed one runs", async () => {
    const build = jest.spyOn(athkarPlayer, "buildQueue").mockRejectedValue(new Error("no queue"));
    await athkarPlayer.startAndJumpTo(ID);
    await athkarPlayer.startAndJumpTo(ID);
    expect(build).toHaveBeenCalledTimes(2);
  });

  test("a queue that fails part-built is removed from the player", async () => {
    withOneDhikr();
    jest.mocked(PlayerQueue.loadPlaylist).mockRejectedValueOnce(new Error("no load"));
    await athkarPlayer.startAndJumpTo(ID);
    expect(PlayerQueue.deletePlaylist).toHaveBeenCalledWith(PLAYLIST);
    expect(state().playerState).toBe(PLAYER_STATE.IDLE);
  });

  test("a track the player cannot start leaves the player idle, with no dhikr loading", async () => {
    withOneDhikr();
    jest.mocked(TrackPlayer.playSong).mockRejectedValueOnce(new Error("no start"));
    await athkarPlayer.startAndJumpTo(ID);
    expect(PlayerQueue.deletePlaylist).toHaveBeenCalledWith(PLAYLIST);
    expect(state().playerState).toBe(PLAYER_STATE.IDLE);
    expect(state().loadingAthkarId).toBeNull();
  });

  test("a dhikr with no audio leaves the player idle, with no dhikr loading", async () => {
    await athkarPlayer.startAndJumpTo(ID);
    expect(state().playerState).toBe(PLAYER_STATE.IDLE);
    expect(state().loadingAthkarId).toBeNull();
  });
});
