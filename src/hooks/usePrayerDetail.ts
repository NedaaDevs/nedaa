import { useCallback, useRef, useState, type RefObject } from "react";
import type { View } from "react-native";
import { useFocusEffect } from "expo-router";

import type { PrayerId } from "@/constants/Prayer";

type PrayerDetail = {
  /** The prayer whose sheet is open; its card and rhythm mark stay chosen. */
  prayerId?: PrayerId;
  open: (id: PrayerId) => void;
  close: () => void;
  /** The chosen card, where reader focus returns once the sheet closes. */
  openerRef: RefObject<View | null>;
};

/** Which prayer's sheet is open, and where focus returns once it closes. */
export const usePrayerDetail = (): PrayerDetail => {
  const [prayerId, setPrayerId] = useState<PrayerId>();
  const openerRef = useRef<View>(null);
  // A row can open another screen; the sheet closes rather than cover it.
  useFocusEffect(useCallback(() => () => setPrayerId(undefined), []));

  return {
    prayerId,
    open: setPrayerId,
    close: () => setPrayerId(undefined),
    openerRef,
  };
};
