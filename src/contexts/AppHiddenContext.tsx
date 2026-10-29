import { createContext } from "react";

/** True while an overlay hides the whole app, as the upgrade path does. */
export const AppHiddenContext = createContext(false);
