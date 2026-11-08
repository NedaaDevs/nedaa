import type { audioDownloadManager } from "@/services/athkar-audio-download";
import type { ReciterCatalogEntry, ReciterManifest } from "@/types/athkar-audio";

/** What a pack download reports when it ends. */
export type PackResult = Awaited<ReturnType<typeof audioDownloadManager.downloadPack>>;

const [FIRST_FILE, SECOND_FILE] = ["thikr-1", "thikr-2"] as const;

/** A catalog reciter with a sample; its pack is not on the device. */
export const RECITER: ReciterCatalogEntry = {
  id: "reciter-1",
  name: { en: "Reciter One" },
  avatar: "",
  type: "clips",
  totalSize: 1_000_000,
  thikrCount: 10,
  sampleUrl: "https://example.com/sample.mp3",
  manifestUrl: "https://example.com/manifest.json",
  isDefault: false,
};

/** The reciter's pack: two files. */
export const MANIFEST: ReciterManifest = {
  id: RECITER.id,
  version: 1,
  type: "clips",
  files: {
    [FIRST_FILE]: { url: "https://example.com/1.mp3", duration: 5, size: 500_000 },
    [SECOND_FILE]: { url: "https://example.com/2.mp3", duration: 5, size: 500_000 },
  },
};

/** A pack download where every file arrives. */
export const PACK_WHOLE: PackResult = { success: 2, failed: 0, failedIds: [] };

/** A pack download where the second file fails. */
export const PACK_ONE_FAILED: PackResult = { success: 1, failed: 1, failedIds: [SECOND_FILE] };
