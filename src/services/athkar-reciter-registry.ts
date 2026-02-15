import * as FileSystem from "expo-file-system/legacy";

import { apiGet } from "@/services/api";
import { AUDIO_STORAGE } from "@/constants/AthkarAudio";
import type { ReciterCatalog, ReciterCatalogEntry, ReciterManifest } from "@/types/athkar-audio";

const API = {
  RECITERS: "/athkar/reciters",
  MANIFEST: (reciterId: string) => `/athkar/reciters/${reciterId}/manifest`,
} as const;

const catalogCachePath = `${FileSystem.documentDirectory}${AUDIO_STORAGE.CATALOG_FILE}`;
const manifestsDir = `${FileSystem.documentDirectory}${AUDIO_STORAGE.MANIFESTS_DIR}`;

let memoryCatalog: ReciterCatalog | null = null;
let memoryManifests: Map<string, ReciterManifest> = new Map();

const ensureDirectories = async () => {
  const info = await FileSystem.getInfoAsync(manifestsDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(manifestsDir, { intermediates: true });
  }
};

const fetchCatalog = async (forceRefresh = false): Promise<ReciterCatalog | null> => {
  // Return memory cache if available and not forcing refresh
  if (memoryCatalog && !forceRefresh) {
    return memoryCatalog;
  }

  // Try local cache first
  if (!forceRefresh) {
    try {
      const info = await FileSystem.getInfoAsync(catalogCachePath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(catalogCachePath);
        const cached = JSON.parse(content) as ReciterCatalog;
        memoryCatalog = cached;
        return cached;
      }
    } catch (error) {
      console.log("[ReciterRegistry] Local cache read failed:", error);
    }
  }

  // Fetch from API
  try {
    const response = await apiGet<ReciterCatalog>(API.RECITERS);

    if (!response.success || !response.data) {
      console.error("[ReciterRegistry] API fetch failed");
      return memoryCatalog;
    }

    const catalog = response.data;
    memoryCatalog = catalog;

    // Cache locally
    await ensureDirectories();
    await FileSystem.writeAsStringAsync(catalogCachePath, JSON.stringify(catalog));

    return catalog;
  } catch (error) {
    console.error("[ReciterRegistry] Error fetching catalog:", error);
    return memoryCatalog;
  }
};

const fetchManifest = async (
  reciterId: string,
  forceRefresh = false
): Promise<ReciterManifest | null> => {
  // Memory cache
  if (!forceRefresh && memoryManifests.has(reciterId)) {
    return memoryManifests.get(reciterId)!;
  }

  const localPath = `${manifestsDir}/${reciterId}.json`;

  // Local cache
  if (!forceRefresh) {
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(localPath);
        const manifest = JSON.parse(content) as ReciterManifest;
        memoryManifests.set(reciterId, manifest);
        return manifest;
      }
    } catch (error) {
      console.log("[ReciterRegistry] Local manifest cache read failed:", error);
    }
  }

  // Fetch from API
  try {
    const response = await apiGet<ReciterManifest>(API.MANIFEST(reciterId));

    if (!response.success || !response.data) {
      console.error("[ReciterRegistry] Manifest fetch failed for", reciterId);
      return memoryManifests.get(reciterId) ?? null;
    }

    const manifest = response.data;
    memoryManifests.set(reciterId, manifest);

    // Cache locally
    await ensureDirectories();
    await FileSystem.writeAsStringAsync(localPath, JSON.stringify(manifest));

    return manifest;
  } catch (error) {
    console.error("[ReciterRegistry] Error fetching manifest:", error);
    return memoryManifests.get(reciterId) ?? null;
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

const getCachedCatalog = (): ReciterCatalog | null => memoryCatalog;

const clearCache = () => {
  memoryCatalog = null;
  memoryManifests.clear();
};

export const reciterRegistry = {
  fetchCatalog,
  fetchManifest,
  getLocalizedName,
  getDefaultReciter,
  getCachedCatalog,
  clearCache,
};
