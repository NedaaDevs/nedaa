import { isNaturalTrackEnd } from "@/services/quran-audio/trackEndDetection";
import { NITRO_REASON } from "@/services/audio/nitroSession";

jest.mock("react-native-nitro-player", () => ({
  TrackPlayer: {
    configure: jest.fn(),
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

describe("isNaturalTrackEnd", () => {
  it("trusts an explicit end reason (Android auto-transition)", () => {
    expect(isNaturalTrackEnd({ reason: NITRO_REASON.END, peakPosition: 0, duration: 0 })).toBe(
      true
    );
  });

  // iOS reports every playlist advance as "skip", so the progress trail decides.
  it("treats a skip from the tail of a short surah as a natural end", () => {
    expect(
      isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 179.2, duration: 180 })
    ).toBe(true);
  });

  it("treats a skip from mid-surah as a user skip", () => {
    expect(isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 42, duration: 180 })).toBe(
      false
    );
  });

  // Nitro's progress observer ticks slower on long items, so the last tick before
  // a natural end trails further behind — the tolerance has to widen with it.
  it("widens the tolerance for surahs over an hour", () => {
    expect(
      isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 3997, duration: 4000 })
    ).toBe(true);
  });

  it("widens the tolerance further for surahs over two hours", () => {
    expect(
      isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 8393, duration: 8400 })
    ).toBe(true);
  });

  it("does not apply the long-surah tolerance to a short surah", () => {
    expect(isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 173, duration: 180 })).toBe(
      false
    );
  });

  it("cannot classify without a known duration", () => {
    expect(isNaturalTrackEnd({ reason: NITRO_REASON.SKIP, peakPosition: 200, duration: 0 })).toBe(
      false
    );
  });
});
