import React, { createContext, use, useMemo, useEffect } from "react";
import { View, I18nManager } from "react-native";
import { useAppStore, getDirection, isRTL as checkIsRTL } from "@/stores/app";

type Direction = "ltr" | "rtl";

type RTLContextValue = {
  isRTL: boolean;
  direction: Direction;
};

const RTLContext = createContext<RTLContextValue | undefined>(undefined);

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

  // Update I18nManager when direction changes (without reload)
  useEffect(() => {
    if (I18nManager.isRTL !== value.isRTL) {
      I18nManager.allowRTL(value.isRTL);
      I18nManager.forceRTL(value.isRTL);
    }
  }, [value.isRTL]);

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
