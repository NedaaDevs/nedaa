import { useCallback, useEffect, useState } from "react";

import { QuranContentDB } from "@/services/quran-content-db";

type DbReadyState = "loading" | "ready" | "error";

// Gates the reader on the bundled `quran.db` being copied + opened. The copy is
// async (and copy-once), so the reader can't assume the DB is there: on a fresh
// install the first open does the copy, which takes a moment and can fail. This
// exposes that as an explicit loading/ready/error state so the screen can show a
// loader and a retry instead of silently rendering an empty page.
export const useQuranContentDbReady = () => {
  const [state, setState] = useState<DbReadyState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // openQuranDb() nulls its cached promise on failure, so a retry re-attempts
    // the copy + open from scratch.
    QuranContentDB.openQuranDb()
      .then(() => !cancelled && setState("ready"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Reset to the loader here (not in the effect) and bump attempt to re-run the
  // open — keeps setState out of the effect body.
  const retry = useCallback(() => {
    setState("loading");
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
};
