import { OrnamentCategory } from "@/enums/quran";
import { apiGet } from "@/services/api";
import { AppLogger } from "@/utils/appLogger";
import { findOrnamentOption, resolveOrnamentStyle } from "@/utils/quranOrnamentResolve";
import type {
  QuranManifest,
  QuranManifestVersion,
  QuranContent,
  QuranPreview,
} from "@/types/quran";
import type { QuranAudioManifest, QuranReciter } from "@/types/quran-audio";

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
    log.i(
      "Manifest",
      `Fetched ${cachedManifest.editions.length} editions, content ${cachedManifest.content.version}`
    );
    return cachedManifest;
  }

  log.e("Manifest", `Failed to fetch: ${response.message ?? "unknown error"}`);
  return null;
};

// Join the single manifest baseUrl with a relative asset path.
const assetUrl = (manifest: QuranManifest, path: string): string =>
  `${manifest.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

const getVersionInfo = async (versionId: string): Promise<QuranManifestVersion | null> => {
  const manifest = await fetchManifest();
  return manifest?.editions.find((e) => e.id === versionId) ?? null;
};

const getVersions = async (): Promise<QuranManifestVersion[]> => {
  const manifest = await fetchManifest();
  const editions = manifest?.editions ?? [];
  // Hide unpublished editions in production; show them all in dev (the version
  // card badges them) so we can test before publishing.
  return __DEV__ ? editions : editions.filter((e) => e.published);
};

// The shared content DB artifact + its absolute URL.
const getContent = async (): Promise<{ content: QuranContent; url: string } | null> => {
  const manifest = await fetchManifest();
  if (!manifest) return null;
  return { content: manifest.content, url: assetUrl(manifest, manifest.content.url) };
};

const getImagesUrl = async (
  version: QuranManifestVersion,
  dark = false
): Promise<string | null> => {
  const manifest = await fetchManifest();
  if (!manifest) return null;
  const asset = dark ? version.images.dark : version.images.light;
  return asset ? assetUrl(manifest, asset.url) : null;
};

const getMetaUrl = async (version: QuranManifestVersion): Promise<string | null> => {
  const manifest = await fetchManifest();
  return manifest ? assetUrl(manifest, version.meta.url) : null;
};

// The resolved ornament pack for a category + edition (+ optional user style
// override) and its version. Null when the manifest ships no CDN pack for this
// category/edition (caller then uses the bundled nedaa fallback).
const getOrnamentPack = async (
  category: OrnamentCategory,
  version: QuranManifestVersion,
  userChoice?: string
): Promise<{ url: string; version: string; styleId: string } | null> => {
  const manifest = await fetchManifest();
  const group = manifest?.ornaments?.[category];
  if (!manifest || !group) return null;
  const styleId = resolveOrnamentStyle(category, version.id, manifest, userChoice);
  const option = findOrnamentOption(group, styleId, version.id);
  return option
    ? { url: assetUrl(manifest, option.url), version: option.version, styleId: option.id }
    : null;
};

const getImagesSizeBytes = (version: QuranManifestVersion, dark = false): number =>
  (dark ? version.images.dark?.bytes : version.images.light.bytes) ?? 0;

const getMetaSizeBytes = (version: QuranManifestVersion): number => version.meta.bytes;

const getTotalSizeBytes = (version: QuranManifestVersion): number =>
  version.images.light.bytes + version.meta.bytes;

export type QuranPreviewImage = {
  page: number;
  url: string;
  width: number;
  height: number;
};

// Preview page images for the version picker, with absolute URLs. Pass
// `{ dark: true }` for the V4 dark-theme set (empty when an edition has none).
const getPreviews = async (
  version: QuranManifestVersion,
  options?: { dark?: boolean }
): Promise<QuranPreviewImage[]> => {
  const manifest = await fetchManifest();
  if (!manifest) return [];
  const list: QuranPreview[] = (options?.dark ? version.darkPreviews : version.previews) ?? [];
  return list.map((p) => ({
    page: p.page,
    url: assetUrl(manifest, p.url),
    width: p.width,
    height: p.height,
  }));
};

// Recitation audio catalog (reciters + nested recitations); absent until a
// reciter is published.
const getAudio = async (): Promise<QuranAudioManifest | null> => {
  const manifest = await fetchManifest();
  return manifest?.audio ?? null;
};

const getReciters = async (): Promise<QuranReciter[]> => {
  const audio = await getAudio();
  return audio?.reciters ?? [];
};

const clearCache = (): void => {
  cachedManifest = null;
  cachedAt = 0;
};

export const QuranManifestService = {
  fetchManifest,
  getVersionInfo,
  getVersions,
  getContent,
  getImagesUrl,
  getMetaUrl,
  getOrnamentPack,
  getImagesSizeBytes,
  getMetaSizeBytes,
  getTotalSizeBytes,
  getPreviews,
  getAudio,
  getReciters,
  clearCache,
};
