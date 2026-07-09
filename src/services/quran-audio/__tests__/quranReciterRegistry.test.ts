import { QuranManifestService } from "@/services/quran-manifest";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import type { QuranReciter, QuranRecitation, QuranAudioManifest } from "@/types/quran-audio";

jest.mock("@/services/quran-manifest", () => ({
  QuranManifestService: { getAudio: jest.fn(), getReciters: jest.fn() },
}));

const rec = (
  id: string,
  granularity: "ayah" | "surah" = "ayah",
  published = true
): QuranRecitation => ({
  id,
  style: "Murattal",
  riwayah: "hafs",
  granularity,
  basePath: `audio/${id}/`,
  fileFormat: "mp3",
  ayahCount: 6236,
  bytesApprox: 1,
  published,
});

const reciter = (id: string, recitations: QuranRecitation[]): QuranReciter => ({
  id,
  nameArabic: `ع-${id}`,
  nameEnglish: `E-${id}`,
  recitations,
});

const setManifest = (defaultRecitationId: string, reciters: QuranReciter[]) => {
  const audio: QuranAudioManifest = { version: "1.0.0", defaultRecitationId, reciters };
  (QuranManifestService.getAudio as jest.Mock).mockResolvedValue(audio);
  (QuranManifestService.getReciters as jest.Mock).mockResolvedValue(reciters);
};

describe("quranReciterRegistry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves a recitation by id across reciters", async () => {
    setManifest("minshawi-murattal", [
      reciter("minshawi", [rec("minshawi-murattal"), rec("minshawi-mujawwad", "surah")]),
      reciter("husary", [rec("husary-murattal")]),
    ]);
    expect((await quranReciterRegistry.getRecitationById("husary-murattal"))?.id).toBe(
      "husary-murattal"
    );
    expect(await quranReciterRegistry.getRecitationById("zzz")).toBeNull();
  });

  it("returns the default recitation, or the first when the id is missing", async () => {
    setManifest("minshawi-mujawwad", [
      reciter("minshawi", [rec("minshawi-murattal"), rec("minshawi-mujawwad", "surah")]),
    ]);
    expect((await quranReciterRegistry.getDefaultRecitation())?.id).toBe("minshawi-mujawwad");

    setManifest("nope", [reciter("minshawi", [rec("minshawi-murattal")])]);
    expect((await quranReciterRegistry.getDefaultRecitation())?.id).toBe("minshawi-murattal");
  });

  it("readerRecitations = ayah-granular only", async () => {
    setManifest("a-x", [
      reciter("a", [rec("a-x"), rec("a-gapless", "surah")]),
      reciter("b", [rec("b-draft", "ayah", false)]),
    ]);
    const ids = (await quranReciterRegistry.readerRecitations()).map((r) => r.id);
    expect(ids).toEqual(["a-x", "b-draft"]); // both ayah; a-gapless is surah
  });

  it("dedupes same-style ayah recitations, keeping the one with word timings", async () => {
    const withTimings: QuranRecitation = {
      ...rec("sudais-recitation"),
      timings: { url: "t.json", version: "1.0.0", bytes: 1 },
    };
    setManifest("minshawi-murattal", [
      reciter("sudais", [rec("sudais-951"), withTimings]), // both Murattal/hafs → collapse
    ]);
    const ids = (await quranReciterRegistry.readerRecitations()).map((r) => r.id);
    expect(ids).toEqual(["sudais-recitation"]); // the timings-bearing one wins
  });

  it("listenReciters keeps only gapless recitations, drops ayah-only reciters", async () => {
    setManifest("a-x", [
      reciter("a", [rec("a-x"), rec("a-gapless", "surah")]),
      reciter("b", [rec("b-murattal")]), // ayah only → dropped entirely
    ]);
    const list = await quranReciterRegistry.listenReciters();
    expect(list.map((r) => r.id)).toEqual(["a"]);
    expect(list[0].recitations.map((x) => x.id)).toEqual(["a-gapless"]);
  });

  it("reciterOf finds the person owning a recitation", async () => {
    setManifest("minshawi-murattal", [reciter("minshawi", [rec("minshawi-murattal")])]);
    expect((await quranReciterRegistry.reciterOf("minshawi-murattal"))?.id).toBe("minshawi");
  });

  it("localizedName prefers Arabic for ar locale, English otherwise", () => {
    const r = reciter("minshawi", []);
    expect(quranReciterRegistry.localizedName(r, "ar")).toBe("ع-minshawi");
    expect(quranReciterRegistry.localizedName(r, "en")).toBe("E-minshawi");
  });
});
