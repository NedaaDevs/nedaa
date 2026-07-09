import { useEffect, useState } from "react";

import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import { QuranContentDB } from "@/services/quran-content-db";

export type FollowTarget = { surah: number; ayah: number; page: number; line: number };

// The page + first line of the ayah currently being recited in the READER (not a
// Listen/gapless session), so the reader can scroll or page-turn to follow along.
// Null when nothing reader-relevant is playing. Resolves the ayah's first glyph on
// each ayah change.
export const useAudioFollowTarget = (): FollowTarget | null => {
  const version = useQuranStore((s) => s.currentVersion);
  const surah = useQuranAudioStore((s) => s.currentSurah);
  const ayah = useQuranAudioStore((s) => s.currentAyah);
  const queueKind = useQuranAudioStore((s) => s.queue?.kind);
  const active = useQuranAudioStore((s) => s.playerState !== QURAN_PLAYER_STATE.IDLE);
  const isReaderPlayback = queueKind != null && queueKind !== QURAN_QUEUE_KIND.SURAH;

  const [target, setTarget] = useState<FollowTarget | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!active || !isReaderPlayback || surah == null || ayah == null) {
        if (alive) setTarget(null);
        return;
      }
      const glyphs = await QuranContentDB.getAyahWordGlyphs(version, surah, ayah);
      if (!alive) return;
      const first = glyphs[0];
      setTarget(first ? { surah, ayah, page: first.page, line: first.line } : null);
    })();
    return () => {
      alive = false;
    };
  }, [version, surah, ayah, queueKind, active, isReaderPlayback]);

  return target;
};
