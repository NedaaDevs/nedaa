import { apiGet } from "@/services/api";
import { AppLogger } from "@/utils/appLogger";
import type { ReciterCatalog, ReciterCatalogEntry, ReciterManifest } from "@/types/athkar-audio";

const log = AppLogger.create("athkar-audio");

const API = {
  RECITERS: "/athkar/reciters",
  MANIFEST: (reciterId: string) => `/athkar/reciters/${reciterId}/manifest`,
} as const;

let lastCatalog: ReciterCatalog | null = null;

const fetchCatalog = async (): Promise<ReciterCatalog | null> => {
  try {
    const response = await apiGet<ReciterCatalog>(API.RECITERS);

    if (!response.success || !response.data) {
      log.e("Registry", "Catalog fetch failed");
      return lastCatalog;
    }

    lastCatalog = response.data;
    return lastCatalog;
  } catch (error) {
    log.e("Registry", "Error fetching catalog", error instanceof Error ? error : undefined);
    return lastCatalog;
  }
};

const fetchManifest = async (reciterId: string): Promise<ReciterManifest | null> => {
  try {
    const response = await apiGet<ReciterManifest>(API.MANIFEST(reciterId));

    if (!response.success || !response.data) {
      log.e("Registry", `Manifest fetch failed for ${reciterId}`);
      return null;
    }

    return response.data;
  } catch (error) {
    log.e("Registry", "Error fetching manifest", error instanceof Error ? error : undefined);
    return null;
  }
};

const getLocalizedName = (name: Record<string, string>, locale: string): string => {
  // Try exact locale match first
  if (name[locale]) return name[locale];

  // Try language code (e.g., "ar" from "ar-SA")
  const lang = locale.split("-")[0];
  if (name[lang]) return name[lang];

  // Fallback to English, then first available
  return name.en || Object.values(name)[0] || "";
};

const getDefaultReciter = async (): Promise<ReciterCatalogEntry | null> => {
  const catalog = await fetchCatalog();
  if (!catalog?.reciters.length) return null;
  return catalog.reciters.find((r) => r.isDefault) ?? catalog.reciters[0];
};

const getCachedCatalog = (): ReciterCatalog | null => lastCatalog;

export const reciterRegistry = {
  fetchCatalog,
  fetchManifest,
  getLocalizedName,
  getDefaultReciter,
  getCachedCatalog,
};
