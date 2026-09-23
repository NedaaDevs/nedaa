import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../tamagui.config";
import { RTLContext } from "@/contexts/RTLContext";

/** The app's Tamagui config in the light theme, read in one direction. */
export const ThemeProvider = ({
  children,
  isRTL = false,
}: {
  children: ReactNode;
  isRTL?: boolean;
}) => (
  <TamaguiProvider config={config} defaultTheme="light">
    <RTLContext value={{ isRTL, direction: isRTL ? "rtl" : "ltr" }}>{children}</RTLContext>
  </TamaguiProvider>
);

export const renderWithTheme = (ui: ReactElement, { isRTL = false } = {}) =>
  render(ui, {
    wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
  });
