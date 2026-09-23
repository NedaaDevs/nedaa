import { useTheme, useThemeName } from "tamagui";

/** A `$key` names a theme value; anything else is already a colour. */
export const resolveThemeColor = (
  color: string,
  themeValue: (key: string) => string | undefined
): string => (color.startsWith("$") ? (themeValue(color.slice(1)) ?? color) : color);

/** For props that reach a native view or an SVG, which take no theme tokens. */
export const useThemeColor = (color: string): string => {
  const theme = useTheme();
  // Reading a value does not re-render on a theme change; the theme name does.
  useThemeName();
  return resolveThemeColor(color, (key) => theme[key]?.val);
};
