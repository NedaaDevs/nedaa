import { useRTL } from "@/contexts/RTLContext";

const MIRROR = { transform: [{ scaleX: -1 }] };

/** A play triangle's flip, so it points along the reading direction. */
export const usePlayFlip = () => (useRTL().isRTL ? MIRROR : undefined);
