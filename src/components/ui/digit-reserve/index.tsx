import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

export type DigitTextProps = Omit<ComponentProps<typeof Text>, "children">;

/** The digits of each script a figure may use: Latin, Arabic, Persian, Urdu. */
const DIGIT_SETS = ["0123456789", "٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹"] as const;

/** The digits of `character`'s script; undefined if it is not a digit. */
export const digitsOf = (character: string) => DIGIT_SETS.find((set) => set.includes(character));

const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

type SizerProps = { digits: string; textProps: DigitTextProps; testID?: string };

/** Every digit of its script in a column, which is as wide as the widest. */
export const DigitSizer = ({ digits, textProps, testID }: SizerProps) => (
  <View testID={testID} {...HIDDEN} style={styles.sizer}>
    {[...digits].map((digit) => (
      <Text key={digit} {...textProps}>
        {digit}
      </Text>
    ))}
  </View>
);

type SlotProps = { text: string; textProps: DigitTextProps; sizerTestID?: string };

/** A character that never moves; a digit is as wide as its script's widest. */
export const DigitSlot = ({ text, textProps, sizerTestID }: SlotProps) => {
  const digits = digitsOf(text);
  return (
    <View style={styles.slot}>
      {digits && <DigitSizer digits={digits} textProps={textProps} testID={sizerTestID} />}
      <Text {...textProps}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  slot: { alignItems: "center", overflow: "hidden" },
  // As wide as its widest digit, and no height, so it sizes only the width.
  sizer: { height: 0, overflow: "hidden" },
});
