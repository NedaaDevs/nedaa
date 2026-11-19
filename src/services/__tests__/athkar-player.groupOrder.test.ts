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
import { PlayerQueue, TrackPlayer, type TrackItem } from "react-native-nitro-player";

import {
  ATHKAR_GROUP_ORDER,
  ATHKAR_GROUP_ORDERS,
  ATHKAR_TYPE,
  type AthkarGroupOrder,
} from "@/constants/Athkar";
import { athkarPlayer } from "@/services/athkar-player";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { useAthkarStore } from "@/stores/athkar";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { textIndexAt, toSessionItems } from "@/utils/athkarSession";
/* eslint-enable import/first */

const AUDIO = ["ikhlas", "falaq", "nas"];
const QULS: Athkar = {
  id: "2",
  title: "",
  text: "",
  count: 9,
  type: ATHKAR_TYPE.MORNING,
  order: 2,
  group: { texts: ["a", "b", "c"], audioIds: AUDIO, itemsPerRound: 3 },
};
const state = () => useAthkarStore.getState();
const urlOf = (audioId: string) => `url:${audioId}`;

const chooseOrder = (groupOrder: AthkarGroupOrder) =>
  useAthkarStore.setState((s) => ({ settings: { ...s.settings, groupOrder } }));

/** The Quls at `count`, under `order`, with every file the reciter has. */
const seed = (order: AthkarGroupOrder, count = 0) => {
  chooseOrder(order);
  useAthkarStore.setState({
    currentType: ATHKAR_TYPE.MORNING,
    morningAthkarList: [QULS],
    currentProgress: [
      { athkarId: QULS.id, currentCount: count, totalCount: QULS.count, completed: false },
    ],
    playerState: PLAYER_STATE.IDLE,
    loadingAthkarId: null,
  });
  jest.mocked(reciterRegistry.fetchManifest).mockResolvedValue({
    id: "reciter",
    version: 1,
    type: "clips",
    files: Object.fromEntries(AUDIO.map((id) => [id, { url: urlOf(id), duration: 1, size: 1 }])),
  });
};

/** The file each queued step plays, in queue order. */
const queued = () =>
  jest
    .mocked(PlayerQueue.addTracksToPlaylist)
    .mock.calls.at(-1)?.[1]
    .map((t: TrackItem) => t.url);

afterEach(async () => {
  await athkarPlayer.stop();
  jest.clearAllMocks();
});

// Each count's step, by round and each in full.
const STEPS: Record<AthkarGroupOrder, string[]> = {
  [ATHKAR_GROUP_ORDER.BY_ROUND]: [0, 1, 2, 0, 1, 2, 0, 1, 2].map((i) => urlOf(AUDIO[i])),
  [ATHKAR_GROUP_ORDER.EACH_IN_FULL]: [0, 0, 0, 1, 1, 1, 2, 2, 2].map((i) => urlOf(AUDIO[i])),
};

describe("a group's audio order", () => {
  test.each(ATHKAR_GROUP_ORDERS)("plays one step per count, %s", async (order) => {
    seed(order);
    await athkarPlayer.startAndJumpTo(QULS.id);
    expect(queued()).toEqual(STEPS[order]);
  });

  test.each(ATHKAR_GROUP_ORDERS)("plays the text each count shows, %s", async (order) => {
    seed(order);
    await athkarPlayer.startAndJumpTo(QULS.id);
    const [item] = toSessionItems([QULS], order);
    const shown = Array.from({ length: QULS.count }, (_, count) =>
      urlOf(AUDIO[textIndexAt(item, count)])
    );
    expect(queued()).toEqual(shown);
  });

  test("resumes each in full on the text the count shows", async () => {
    seed(ATHKAR_GROUP_ORDER.EACH_IN_FULL, 3);
    await athkarPlayer.startAndJumpTo(QULS.id);
    expect(TrackPlayer.playSong).toHaveBeenLastCalledWith("t3", "playlist");
    expect(state().currentThikrId).toBe(AUDIO[1]);
    // The first of the second text's three repeats.
    expect(state().groupProgress).toMatchObject({ groupIndex: 1, round: 1, totalRounds: 3 });
  });

  test("by round, the progress names the round", async () => {
    seed(ATHKAR_GROUP_ORDER.BY_ROUND, 4);
    await athkarPlayer.startAndJumpTo(QULS.id);
    expect(state().currentThikrId).toBe(AUDIO[1]);
    expect(state().groupProgress).toMatchObject({ groupIndex: 1, round: 2, totalRounds: 3 });
  });

  test("a new order ends the queue built under the old one", async () => {
    seed(ATHKAR_GROUP_ORDER.BY_ROUND, 3);
    await athkarPlayer.startAndJumpTo(QULS.id);
    useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING });

    chooseOrder(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
    await new Promise((resolve) => setImmediate(resolve));

    expect(PlayerQueue.deletePlaylist).toHaveBeenCalledWith("playlist");
    expect(state().playerState).toBe(PLAYER_STATE.IDLE);
    expect(athkarPlayer.isActive()).toBe(false);
  });

  test("a group with a file the reciter lacks is left out whole", async () => {
    seed(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
    jest.mocked(reciterRegistry.fetchManifest).mockResolvedValue({
      id: "reciter",
      version: 1,
      type: "clips",
      files: { [AUDIO[0]]: { url: urlOf(AUDIO[0]), duration: 1, size: 1 } },
    });
    await athkarPlayer.startAndJumpTo(QULS.id);
    expect(PlayerQueue.addTracksToPlaylist).not.toHaveBeenCalled();
    expect(athkarPlayer.isActive()).toBe(false);
  });

  test("an order chosen while the queue loads ends that queue", async () => {
    seed(ATHKAR_GROUP_ORDER.BY_ROUND);
    jest.mocked(PlayerQueue.addTracksToPlaylist).mockImplementationOnce(async () => {
      chooseOrder(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
    });
    await athkarPlayer.startAndJumpTo(QULS.id);

    expect(PlayerQueue.deletePlaylist).toHaveBeenCalledWith("playlist");
    expect(TrackPlayer.playSong).not.toHaveBeenCalled();
    expect(athkarPlayer.isActive()).toBe(false);
  });

  test("another setting leaves the queue playing", async () => {
    seed(ATHKAR_GROUP_ORDER.BY_ROUND);
    await athkarPlayer.startAndJumpTo(QULS.id);
    useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING });

    useAthkarStore.setState((s) => ({
      settings: { ...s.settings, showTranslation: !s.settings.showTranslation },
    }));
    await new Promise((resolve) => setImmediate(resolve));

    expect(PlayerQueue.deletePlaylist).not.toHaveBeenCalled();
    expect(state().playerState).toBe(PLAYER_STATE.PLAYING);
  });
});
