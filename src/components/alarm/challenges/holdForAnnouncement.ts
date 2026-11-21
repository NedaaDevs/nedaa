import { AccessibilityInfo, Platform } from "react-native";

import { ANNOUNCEMENT_FINISHED } from "@/constants/Accessibility";
import { DHIKR_HOLD_MS, SPOKEN_MS_PER_CHARACTER } from "@/constants/WakeTaskBoards";
import { PlatformType } from "@/enums/app";

/** Calls `onEnd` once `message` has been said and the screen reader's
 *  minimum hold has passed; returns a cancel. */
export const holdForAnnouncement = (message: string, onEnd: () => void): (() => void) => {
  // Android reports no end of speech, so the hold is timed from the length.
  if (Platform.OS !== PlatformType.IOS) {
    const spoken = message.length * SPOKEN_MS_PER_CHARACTER;
    const id = setTimeout(onEnd, Math.max(DHIKR_HOLD_MS.SCREEN_READER, spoken));
    return () => clearTimeout(id);
  }
  const held = { waited: false, heard: false };
  const settle = () => {
    if (!held.waited || !held.heard) return;
    cancel();
    onEnd();
  };
  const subscription = AccessibilityInfo.addEventListener(
    ANNOUNCEMENT_FINISHED,
    ({ announcement }) => {
      if (announcement !== message) return;
      held.heard = true;
      settle();
    }
  );
  const minimum = setTimeout(() => {
    held.waited = true;
    settle();
  }, DHIKR_HOLD_MS.SCREEN_READER);
  // A lost end-of-speech event cannot hold the board past the ceiling.
  const ceiling = setTimeout(() => {
    held.waited = held.heard = true;
    settle();
  }, DHIKR_HOLD_MS.CEILING);
  const cancel = () => {
    clearTimeout(minimum);
    clearTimeout(ceiling);
    subscription.remove();
  };
  return cancel;
};
