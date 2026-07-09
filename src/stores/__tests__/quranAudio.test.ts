import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_LISTEN_MODE } from "@/types/quran-audio";

jest.mock("expo-sqlite/kv-store", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const reset = () =>
  useQuranAudioStore.setState({
    playerState: QURAN_PLAYER_STATE.IDLE,
    currentSurah: null,
    currentAyah: null,
    queue: null,
    following: true,
    position: 0,
    duration: 0,
  });

describe("quranAudio store", () => {
  beforeEach(reset);

  it("defaults reader + listen to the minshawi-murattal recitation and STOP listen mode", () => {
    expect(useQuranAudioStore.getState().readerRecitationId).toBe("minshawi-murattal");
    expect(useQuranAudioStore.getState().listenRecitationId).toBe("minshawi-murattal");
    expect(useQuranAudioStore.getState().listenMode).toBe(QURAN_LISTEN_MODE.STOP);
  });

  it("setCurrentAyah updates surah + ayah together", () => {
    useQuranAudioStore.getState().setCurrentAyah(2, 255);
    expect(useQuranAudioStore.getState().currentSurah).toBe(2);
    expect(useQuranAudioStore.getState().currentAyah).toBe(255);
  });

  it("resetPlayback clears playing state and re-arms following", () => {
    const s = useQuranAudioStore.getState();
    s.setCurrentAyah(2, 255);
    s.setPlayerState(QURAN_PLAYER_STATE.PLAYING);
    s.setFollowing(false);
    s.resetPlayback();
    const after = useQuranAudioStore.getState();
    expect(after.playerState).toBe(QURAN_PLAYER_STATE.IDLE);
    expect(after.currentAyah).toBeNull();
    expect(after.queue).toBeNull();
    expect(after.following).toBe(true);
  });
});
