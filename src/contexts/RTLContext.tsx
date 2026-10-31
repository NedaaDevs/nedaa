import React, { createContext, use, useMemo } from "react";
import { View } from "react-native";
import { useAppStore, getDirection, isRTL as checkIsRTL } from "@/stores/app";

type Direction = "ltr" | "rtl";

type RTLContextValue = {
  isRTL: boolean;
  direction: Direction;
};

// Exported so portaled surfaces (e.g. Tamagui Sheet) can re-provide the value.
export const RTLContext = createContext<RTLContextValue | undefined>(undefined);

export const RTLProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const locale = useAppStore((state) => state.locale);

  const value = useMemo(() => {
    const direction = getDirection(locale);
    const isRTL = checkIsRTL(direction);
    return {
      isRTL,
      direction,
    };
  }, [locale]);

  return (
    <RTLContext value={value}>
      <View style={{ flex: 1, direction: value.direction }}>{children}</View>
    </RTLContext>
  );
};

export const useRTL = (): RTLContextValue => {
  const context = use(RTLContext);
  if (context === undefined) {
    throw new Error("useRTL must be used within RTLProvider");
  }
  return context;
};
