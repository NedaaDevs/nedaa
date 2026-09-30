import { useCallback, useRef, useState, type RefObject } from "react";
import type { View } from "react-native";
import { useFocusEffect } from "expo-router";

import type { PrayerId } from "@/constants/Prayer";
import { useNotificationEditSession } from "@/hooks/useNotificationEditSession";

type PrayerDetail = {
  /** The prayer whose sheet is open; its card and rhythm mark stay chosen. */
  prayerId?: PrayerId;
  open: (id: PrayerId, opener: View | null) => void;
  close: () => void;
  /** The card last opened, where reader focus returns once the sheet closes. */
  openerRef: RefObject<View | null>;
};

/** Which prayer's sheet is open, with one edit session while it is. */
// Call it from the screen: a sheet body renders in a portal, outside focus.
export const usePrayerDetail = (): PrayerDetail => {
  const [prayerId, setPrayerId] = useState<PrayerId>();
  const openerRef = useRef<View>(null);
  useNotificationEditSession(prayerId !== undefined);
  // A row can open another screen; the sheet closes rather than cover it.
  useFocusEffect(useCallback(() => () => setPrayerId(undefined), []));

  return {
    prayerId,
    open: (id, opener) => {
      openerRef.current = opener;
      setPrayerId(id);
    },
    close: () => setPrayerId(undefined),
    openerRef,
  };
};
