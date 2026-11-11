import { createContext, use } from "react";

import type { Phase } from "@/constants/Phase";

/** The phase the root resolved; a day run never provides it. */
export const LivePhaseContext = createContext<Phase | undefined>(undefined);

/** The real phase now, even inside a day run; undefined before times load. */
export const useLivePhase = (): Phase | undefined => use(LivePhaseContext);
