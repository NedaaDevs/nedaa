import { useContext } from "react";
// The tab view provides this context through expo-router's own copy of React
// Navigation; a separately installed copy would be a different context.
import { BottomTabBarHeightContext } from "expo-router/build/react-navigation/bottom-tabs/utils/BottomTabBarHeightContext";

/** Room a screen leaves at its bottom for a floating tab bar; 0 elsewhere. */
export const useTabBarInset = (): number => useContext(BottomTabBarHeightContext) ?? 0;
