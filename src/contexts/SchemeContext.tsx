import { createContext, use } from "react";
import { Appearance, type ColorSchemeName } from "react-native";

/** Marks a tree with no root above it. */
const NO_ROOT = Symbol("no root");

type HeldScheme = ColorSchemeName | null | undefined;

/** The scheme the root draws by; a flip holds it until its dissolve. */
export const SchemeContext = createContext<HeldScheme | typeof NO_ROOT>(NO_ROOT);

/**
 * The scheme the app draws by: the root's, or, with no root above (a test,
 * a preview), the phone's at render time.
 */
export const useAppScheme = (): HeldScheme => {
  const held = use(SchemeContext);
  return held === NO_ROOT ? Appearance.getColorScheme() : held;
};
