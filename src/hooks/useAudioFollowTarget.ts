import { useEffect, useMemo, useState } from "react";

import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import { QuranContentDB } from "@/services/quran-content-db";

export type FollowTarget = { surah: number; ayah: number; page: number; line: number };

// The page + line the reader should keep in view while a READER recitation plays
// (not a Listen/gapless session). Prefers the exact highlighted word (word mode)
// so it tracks line-by-line; falls back to the ayah's first line (verse mode or
// before the first word resolves). Null when nothing reader-relevant is playing.
export const useAudioFollowTarget = (): FollowTarget | null => {
  const version = useQuranStore((s) => s.currentVersion);
  const word = useQuranStore((s) => s.readAlongWord);
  const surah = useQuranAudioStore((s) => s.currentSurah);
  const ayah = useQuranAudioStore((s) => s.currentAyah);
  const queueKind = useQuranAudioStore((s) => s.queue?.kind);
  const active = useQuranAudioStore((s) => s.playerState !== QURAN_PLAYER_STATE.IDLE);
  const isReaderPlayback = queueKind != null && queueKind !== QURAN_QUEUE_KIND.SURAH;

  // The ayah's first line, resolved on ayah change (the fallback target).
  const [ayahStart, setAyahStart] = useState<{ page: number; line: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!active || !isReaderPlayback || surah == null || ayah == null) {
        if (alive) setAyahStart(null);
        return;
      }
      const glyphs = await QuranContentDB.getAyahWordGlyphs(version, surah, ayah);
      if (!alive) return;
      const first = glyphs[0];
      setAyahStart(first ? { page: first.page, line: first.line } : null);
    })();
    return () => {
      alive = false;
    };
  }, [version, surah, ayah, queueKind, active, isReaderPlayback]);

  // Prefer the exact highlighted word's line; fall back to the ayah's first line.
  const wordMatches = word != null && word.surah === surah && word.ayah === ayah;
  const page = wordMatches ? word.page : ayahStart?.page;
  const line = wordMatches ? word.line : ayahStart?.line;

  // Stable identity per (surah, ayah, page, line): consumers' follow effects run
  // on target change, and word ticks within the same line must not re-fire them.
  return useMemo(() => {
    if (!active || !isReaderPlayback || surah == null || ayah == null) return null;
    if (page == null || line == null) return null;
    return { surah, ayah, page, line };
  }, [active, isReaderPlayback, surah, ayah, page, line]);
};
