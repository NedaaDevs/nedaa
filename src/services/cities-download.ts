import { DownloadTask, File, Paths } from "expo-file-system";
import type { DownloadTaskOptions } from "expo-file-system";
import { Platform } from "react-native";

// Constants
import { CITIES_DB_NAME } from "@/constants/DB";
import { CITIES_PACK_VERSION, CITIES_PACK_BYTES } from "@/constants/Cities";
import { appGroupId } from "@/constants/App";

// Enums
import { PlatformType } from "@/enums/app";

// Services
import { citiesPackUrl } from "@/services/citiesDbStrategy";

// Utils
import { getUserAgent } from "@/utils/userAgent";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

const getDbDirectory = () => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId] ?? Paths.document;
  }
  return Paths.document;
};

export type CitiesDownloadProgress = {
  receivedBytes: number;
  totalBytes: number;
};

export type CitiesDownloadOptions = {
  onProgress: (progress: CitiesDownloadProgress) => void;
  signal?: AbortSignal;
};

/**
 * Downloads the full cities pack into the cache, then moves it into the database
 * directory only after a verified non-empty file exists. An interrupted download
 * therefore never leaves a partial file where `isFullPackInstalled` would see it.
 *
 * The CDN serves the artifact gzipped with `Content-Encoding: gzip`, so the transport
 * decompresses it and what lands on disk is a plain SQLite file.
 */
export const downloadCitiesPack = async ({
  onProgress,
  signal,
}: CitiesDownloadOptions): Promise<void> => {
  const staging = new File(Paths.cache, `${CITIES_DB_NAME}.download`);
  if (staging.exists) staging.delete();

  const url = citiesPackUrl(CITIES_PACK_VERSION);
  const options: DownloadTaskOptions = {
    signal,
    headers: { "User-Agent": getUserAgent() },
    onProgress: ({ bytesWritten, totalBytes }) => {
      // The CDN may omit Content-Length (totalBytes === -1); fall back to the declared
      // size so the progress bar still advances.
      onProgress({
        receivedBytes: bytesWritten,
        totalBytes: totalBytes > 0 ? totalBytes : CITIES_PACK_BYTES,
      });
    },
  };

  log.i("CitiesDB", `downloading full pack v${CITIES_PACK_VERSION}`);
  const downloaded = await new DownloadTask(url, staging, options).downloadAsync();

  if (!downloaded || !staging.exists || staging.size === 0) {
    if (staging.exists) staging.delete();
    throw new Error("Cities pack download produced no file");
  }

  const target = new File(getDbDirectory(), CITIES_DB_NAME);
  // A stale database and its write-ahead sidecars would otherwise shadow the new file.
  if (target.exists) target.delete();
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = new File(getDbDirectory(), `${CITIES_DB_NAME}${suffix}`);
    if (sidecar.exists) sidecar.delete();
  }

  staging.move(target);
  log.i("CitiesDB", `installed full pack v${CITIES_PACK_VERSION} (${target.size} bytes)`);
};
