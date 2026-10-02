import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";

/** `AccessibilityInfo` events that report an OS setting turning on or off. */
export const A11Y_FLAG_EVENT = {
  SCREEN_READER: "screenReaderChanged",
  REDUCE_MOTION: "reduceMotionChanged",
} as const;

export type A11yFlagEvent = (typeof A11Y_FLAG_EVENT)[keyof typeof A11Y_FLAG_EVENT];

/** Standard accessibility action names React Native reports. */
export const A11Y_ACTION = {
  ACTIVATE: "activate",
  INCREMENT: "increment",
  DECREMENT: "decrement",
} as const;

// TalkBack adjusts only through listed actions. VoiceOver adjusts without them,
// and would list each one in its rotor under its raw English name.
export const adjustActions = () =>
  Platform.OS === PlatformType.ANDROID
    ? [{ name: A11Y_ACTION.INCREMENT }, { name: A11Y_ACTION.DECREMENT }]
    : undefined;

/** Keeps a subtree out of the accessibility tree; its frame speaks for it. */
export const HIDDEN_FROM_READER = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;
