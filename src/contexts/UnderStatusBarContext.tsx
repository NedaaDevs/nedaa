import { createContext } from "react";

/** The height of the status bar a screen draws under; null when padded. */
export const UnderStatusBarContext = createContext<number | null>(null);
