import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { BookmarkColor } from "@/enums/quran";

export interface Bookmark {
  surah: number;
  ayah: number;
  page: number;
  color: BookmarkColor;
  createdAt: number;
}

interface BookmarkState {
  bookmarks: Bookmark[];
  // Assign a colour to an ayah. Each colour is a single mushaf-wide slot, so this
  // moves the colour off any other ayah and replaces any colour already on this one.
  setBookmark: (surah: number, ayah: number, page: number, color: BookmarkColor) => void;
  removeBookmark: (surah: number, ayah: number) => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set) => ({
      bookmarks: [],

      setBookmark: (surah, ayah, page, color) =>
        set((prev) => ({
          bookmarks: [
            ...prev.bookmarks.filter(
              (b) => b.color !== color && !(b.surah === surah && b.ayah === ayah)
            ),
            { surah, ayah, page, color, createdAt: Date.now() },
          ],
        })),

      removeBookmark: (surah, ayah) =>
        set((prev) => ({
          bookmarks: prev.bookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah)),
        })),
    }),
    {
      name: "quran-bookmarks",
      storage: createJSONStorage(() => Storage),
    }
  )
);
