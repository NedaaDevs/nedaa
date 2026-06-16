import { useEffect, useState } from "react";

import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranStore } from "@/stores/quran";

const EMPTY: Set<string> = new Set();

// "surah:ayah" keys of the verses on a page that belong to a mutashabihat group.
// Returns an empty set when the marker setting is off, so it costs nothing then.
export const useMutashabihatKeys = (page: number): Set<string> => {
  const enabled = useQuranStore((s) => s.showMutashabihatMarkers);
  const [keys, setKeys] = useState<Set<string>>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKeys(EMPTY);
      return;
    }
    let alive = true;
    QuranContentDB.getMutashabihatKeysForPage(page).then((k) => {
      if (alive) setKeys(k);
    });
    return () => {
      alive = false;
    };
  }, [page, enabled]);

  return keys;
};
