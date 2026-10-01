import { createContext, use } from "react";

/** Runs `fn`, which changes the theme, under a dissolve of the whole screen. */
export type WithThemeTransition = (fn: () => void | Promise<void>) => Promise<void>;

const runAtOnce: WithThemeTransition = async (fn) => {
  await fn();
};

/** The root's dissolve; with no provider above, the change runs at once. */
export const ThemeTransitionContext = createContext<WithThemeTransition>(runAtOnce);

/** True while a snapshot covers the screen for a theme change. */
export const ThemeDissolvingContext = createContext(false);

export const useThemeTransition = (): WithThemeTransition => use(ThemeTransitionContext);

export const useThemeDissolving = (): boolean => use(ThemeDissolvingContext);
