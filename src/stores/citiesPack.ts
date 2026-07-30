import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Services
import { downloadCitiesPack } from "@/services/cities-download";
import { isFullPackInstalled, invalidateCitiesDb } from "@/services/cities-db";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

export type CitiesPackStore = {
  isInstalled: boolean;
  isDownloading: boolean;
  receivedBytes: number;
  totalBytes: number;
  error: string | null;
  refreshInstalled: () => void;
  download: () => Promise<void>;
  cancel: () => void;
};

let controller: AbortController | null = null;

export const useCitiesPackStore = create<CitiesPackStore>()(
  devtools(
    (set, get) => ({
      isInstalled: false,
      isDownloading: false,
      receivedBytes: 0,
      totalBytes: 0,
      error: null,

      refreshInstalled: () => set({ isInstalled: isFullPackInstalled() }),

      download: async () => {
        if (get().isDownloading) return;

        controller = new AbortController();
        set({ isDownloading: true, error: null, receivedBytes: 0, totalBytes: 0 });

        try {
          await downloadCitiesPack({
            signal: controller.signal,
            onProgress: ({ receivedBytes, totalBytes }) => set({ receivedBytes, totalBytes }),
          });

          // The open connection still points at the seed until it is dropped.
          invalidateCitiesDb();
          set({ isInstalled: isFullPackInstalled(), isDownloading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Cities pack download failed";
          log.w("CitiesDB", `full pack download failed: ${message}`);
          // The bundled seed stays usable, so a failure never blocks picking a city.
          set({ isDownloading: false, error: message });
        } finally {
          controller = null;
        }
      },

      cancel: () => {
        controller?.abort();
        set({ isDownloading: false });
      },
    }),
    { name: "CitiesPackStore" }
  )
);

export default useCitiesPackStore;
