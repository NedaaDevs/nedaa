import {
  remoteAyahUrl,
  remoteSurahUrl,
  buildAyahRange,
} from "@/services/quran-audio/quranAudioUrl";
import type { QuranRecitation } from "@/types/quran-audio";

const minshawi: QuranRecitation = {
  id: "minshawi-murattal",
  style: "Murattal",
  riwayah: "hafs",
  granularity: "ayah",
  basePath: "audio/minshawi-murattal/",
  fileFormat: "mp3",
  ayahCount: 6236,
  bytesApprox: 1706453407,
  published: true,
};

describe("quranAudioUrl", () => {
  it("joins baseUrl + basePath + non-padded surah_ayah.ext", () => {
    expect(remoteAyahUrl("https://cdn.nedaa.dev/quran", minshawi, 2, 255)).toBe(
      "https://cdn.nedaa.dev/quran/audio/minshawi-murattal/2_255.mp3"
    );
  });

  it("tolerates trailing/leading slashes", () => {
    expect(remoteAyahUrl("https://cdn.nedaa.dev/quran/", minshawi, 1, 1)).toBe(
      "https://cdn.nedaa.dev/quran/audio/minshawi-murattal/1_1.mp3"
    );
  });

  it("builds a gapless surah url (one file per surah)", () => {
    expect(remoteSurahUrl("https://cdn.nedaa.dev/quran", minshawi, 112)).toBe(
      "https://cdn.nedaa.dev/quran/audio/minshawi-murattal/112.mp3"
    );
  });

  it("builds an inclusive ayah range", () => {
    const items = buildAyahRange(112, 1, 4, (s, a) => `u/${s}/${a}`);
    expect(items).toEqual([
      { surah: 112, ayah: 1, url: "u/112/1" },
      { surah: 112, ayah: 2, url: "u/112/2" },
      { surah: 112, ayah: 3, url: "u/112/3" },
      { surah: 112, ayah: 4, url: "u/112/4" },
    ]);
  });

  it("returns a single-item range when from === to", () => {
    expect(buildAyahRange(1, 5, 5, (s, a) => `u/${s}/${a}`)).toEqual([
      { surah: 1, ayah: 5, url: "u/1/5" },
    ]);
  });
});
