import { apiGet } from "@/services/api";
import { AppLogger } from "@/utils/appLogger";
import type { QuranManifest, QuranManifestVersion } from "@/types/quran";

const log = AppLogger.create("quran-manifest");

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedManifest: QuranManifest | null = null;
let cachedAt = 0;

const fetchManifest = async (): Promise<QuranManifest | null> => {
  if (cachedManifest && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedManifest;
  }

  const response = await apiGet<QuranManifest>("/quran/manifest");

  if (response.success) {
    cachedManifest = response.data;
    cachedAt = Date.now();
    log.i("Manifest", `Fetched ${cachedManifest.versions.length} versions`);
    return cachedManifest;
  }

  log.e("Manifest", `Failed to fetch: ${response.message ?? "unknown error"}`);
  return null;
};

const getVersionInfo = async (versionId: string): Promise<QuranManifestVersion | null> => {
  const manifest = await fetchManifest();
  if (!manifest) return null;
  return manifest.versions.find((v) => v.id === versionId) ?? null;
};

const getVersions = async (): Promise<QuranManifestVersion[]> => {
  const manifest = await fetchManifest();
  return manifest?.versions ?? [];
};

const getLineImageUrl = (version: QuranManifestVersion, page: number, line: number): string => {
  const pageStr = String(page).padStart(3, "0");
  const lineStr = String(line).padStart(3, "0");
  return `${version.baseUrl}${version.paths.lines
    .replace("{page}", pageStr)
    .replace("{line}", lineStr)}`;
};

const getBoundsDbUrl = (version: QuranManifestVersion): string => {
  return `${version.baseUrl}${version.paths.boundsDb}`;
};

const getMarkerUrl = (version: QuranManifestVersion, name: string): string => {
  return `${version.baseUrl}${version.paths.markers.replace("{name}", name)}`;
};

const clearCache = (): void => {
  cachedManifest = null;
  cachedAt = 0;
};

export const QuranManifestService = {
  fetchManifest,
  getVersionInfo,
  getVersions,
  getLineImageUrl,
  getBoundsDbUrl,
  getMarkerUrl,
  clearCache,
};
