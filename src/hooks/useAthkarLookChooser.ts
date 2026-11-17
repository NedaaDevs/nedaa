import { useState } from "react";

import type { AthkarLookId } from "@/constants/AthkarLook";
import { CHOOSER_MODE, type ChooserMode } from "@/constants/AthkarLookChooser";
import { useAthkarLookId } from "@/hooks/useAthkarLook";
import { usePersistHydrated } from "@/hooks/usePersistHydrated";
import { useAthkarStore } from "@/stores/athkar";

/** A look chooser that is open: the look tried on, and the ways to pick and keep one. */
export type AthkarLookChooser = {
  mode: ChooserMode;
  /** The look the reader wears while a person chooses. */
  look: AthkarLookId;
  /** The look in use before this choice. */
  current: AthkarLookId;
  pick: (look: AthkarLookId) => void;
  /** Stores the look tried on. */
  confirm: () => void;
};

type Options = {
  /** Opens the chooser in this mode whatever is stored. */
  mode?: ChooserMode;
  /** Keeps a first-visit chooser closed. */
  held?: boolean;
};

/** The look chooser when it is open: asked for by mode, or a first visit with no look stored. */
export const useAthkarLookChooser = ({ mode, held = false }: Options): AthkarLookChooser | null => {
  const hydrated = usePersistHydrated(useAthkarStore.persist);
  const unchosen = useAthkarStore((state) => state.settings.look === null);
  const setLook = useAthkarStore((state) => state.setLook);
  const current = useAthkarLookId();
  const [picked, setPicked] = useState<AthkarLookId | null>(null);

  const open = mode ?? (hydrated && unchosen && !held ? CHOOSER_MODE.FIRST : null);
  if (open === null) return null;

  const look = picked ?? current;
  return { mode: open, look, current, pick: setPicked, confirm: () => setLook(look) };
};
