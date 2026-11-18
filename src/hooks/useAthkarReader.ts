import { useState } from "react";
import { useTranslation } from "react-i18next";

import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { useChangeOnly } from "@/hooks/useChangeOnly";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText, useRatioText } from "@/hooks/useRatioText";

/** What every look's reader says and counts, for the look to draw. */
export type AthkarReader = {
  current: NonNullable<AthkarSession["current"]>;
  count: number;
  target: number;
  /** The count against its target, 0 to 1. */
  fraction: number;
  countText: string;
  targetText: string;
  /** The place as drawn, such as "9 / 18", and the count likewise. */
  figures: string;
  ratio: string;
  /** The place and the count as a screen reader says them. */
  placeLine: string;
  counted: string;
  /** What a press on the count does, or why it does nothing. */
  hint: string;
  /** The line to speak as the count or the place changes. */
  said: string | null;
  /** Counts one repeat, with its haptics. */
  add: () => void;
};

/** The line last drawn at a place, and what was said for it. */
type Heard = { place: number; line: string; said: string | null };

/** The reader's rules every look shares; null while the session has no dhikr. */
export const useAthkarReader = (session: AthkarSession): AthkarReader | null => {
  const { t } = useTranslation();
  const countText = useCountText();
  const ratioText = useRatioText();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);

  const { current, index, items } = session;
  const place = index ?? 0;
  const count = current?.count ?? 0;
  const target = current?.target ?? 0;
  // Spoken as words; a reader says the slash of the drawn figures as a symbol.
  const placeLine = t("athkar.audio.thikrProgress", {
    current: countText(place + 1),
    total: countText(items.length),
  });
  const counted = t("a11y.athkar.cardProgress", {
    current: countText(count),
    total: countText(target),
  });
  const line = count === 0 ? placeLine : counted;
  // A count the audio makes stays unsaid; the recitation is playing.
  const unsaid = count > 0 && current?.audioOwnsCount;
  const [heard, setHeard] = useState<Heard>({ place, line, said: line });
  if (heard.place !== place) setHeard({ place, line, said: placeLine });
  else if (heard.line !== line) setHeard({ place, line, said: unsaid ? null : line });
  const said = useChangeOnly(heard.said);

  if (!current) return null;

  const hint = current.audioOwnsCount
    ? t("athkar.session.audioCounts")
    : current.done
      ? t("athkar.session.thikrDone")
      : t("athkar.focus.tapToIncrement");

  const add = () => {
    void hapticSelection();
    if (count + 1 === target) void hapticSuccess();
    session.add();
  };

  return {
    current,
    count,
    target,
    fraction: target > 0 ? count / target : 0,
    countText: countText(count),
    targetText: countText(target),
    figures: ratioText(place + 1, items.length),
    ratio: ratioText(count, target),
    placeLine,
    counted,
    hint,
    said,
    add,
  };
};
