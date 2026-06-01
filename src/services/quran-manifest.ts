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

const getBundleUrl = (version: QuranManifestVersion): string => {
  return `${version.baseUrl}${version.bundle.path}`;
};

const getBundleSizeBytes = (version: QuranManifestVersion): number => {
  return Math.round(version.bundle.sizeMB * 1024 * 1024);
};

const getDarkBundleUrl = (version: QuranManifestVersion): string | null => {
  return version.darkBundle ? `${version.baseUrl}${version.darkBundle.path}` : null;
};

const getDarkBundleSizeBytes = (version: QuranManifestVersion): number => {
  return version.darkBundle ? Math.round(version.darkBundle.sizeMB * 1024 * 1024) : 0;
};

const clearCache = (): void => {
  cachedManifest = null;
  cachedAt = 0;
};

export const QuranManifestService = {
  fetchManifest,
  getVersionInfo,
  getVersions,
  getBundleUrl,
  getBundleSizeBytes,
  getDarkBundleUrl,
  getDarkBundleSizeBytes,
  clearCache,
};
