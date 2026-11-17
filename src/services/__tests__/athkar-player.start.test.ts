jest.mock("react-native-nitro-player", () => ({
  TrackPlayer: { pause: jest.fn(async () => {}) },
  PlayerQueue: { deletePlaylist: jest.fn(async () => {}) },
}));
jest.mock("@/services/audio/nitroSession", () => ({
  nitroSession: { register: jest.fn(), ensureStarted: jest.fn(async () => {}), release: jest.fn() },
}));
jest.mock("@/services/athkar-audio-download", () => ({ audioDownloadManager: {} }));
jest.mock("@/services/athkar-reciter-registry", () => ({
  reciterRegistry: { fetchManifest: jest.fn(async () => ({ files: {} })) },
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
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
/* eslint-enable import/first */

const ID = "1";
const state = () => useAthkarStore.getState();

beforeEach(() => {
  useAthkarStore.setState({
    currentType: ATHKAR_TYPE.MORNING,
    morningAthkarList: [],
    playerState: PLAYER_STATE.IDLE,
    loadingAthkarId: null,
  });
});
afterEach(() => jest.restoreAllMocks());

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
});
