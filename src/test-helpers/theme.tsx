import type { ReactElement, ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { render } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../tamagui.config";
import { RTLContext } from "@/contexts/RTLContext";

/** The app root's providers: light theme, one direction, gesture root. */
export const ThemeProvider = ({
  children,
  isRTL = false,
}: {
  children: ReactNode;
  isRTL?: boolean;
}) => (
  <TamaguiProvider config={config} defaultTheme="light">
    <RTLContext value={{ isRTL, direction: isRTL ? "rtl" : "ltr" }}>
      <GestureHandlerRootView>{children}</GestureHandlerRootView>
    </RTLContext>
  </TamaguiProvider>
);

export const renderWithTheme = (ui: ReactElement, { isRTL = false } = {}) =>
  render(ui, {
    wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
  });
