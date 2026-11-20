import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Services
import { downloadCitiesPack } from "@/services/cities-download";
import { isFullPackInstalled, invalidateCitiesDb } from "@/services/cities-db";

// Utils
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

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

        const own = new AbortController();
        controller = own;
        set({ isDownloading: true, error: null, receivedBytes: 0, totalBytes: 0 });

        try {
          await downloadCitiesPack({
            signal: own.signal,
            // A cancelled task's late event leaves a newer download's meter.
            onProgress: ({ receivedBytes, totalBytes }) => {
              if (!own.signal.aborted) set({ receivedBytes, totalBytes });
            },
          });

          // The open connection still points at the seed until it is dropped. The
          // download already released it before installing; this covers the case where
          // it was reopened while the download ran.
          await invalidateCitiesDb();
          const isInstalled = isFullPackInstalled();
          // A cancel after the install leaves a newer download's flag.
          set(own.signal.aborted ? { isInstalled } : { isInstalled, isDownloading: false });
        } catch (error) {
          // A cancel rejects the task; it returns to the offer, not a failure.
          if (own.signal.aborted) return;
          const message = errorText(error);
          log.w("CitiesDB", `full pack download failed: ${message}`);
          // The bundled seed stays usable, so a failure never blocks picking a city.
          set({ isDownloading: false, error: message });
        } finally {
          // A cancelled task settling late keeps a newer download's controller.
          if (controller === own) controller = null;
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
