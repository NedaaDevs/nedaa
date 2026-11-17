import { StyleSheet, View } from "react-native";

import { DigitSizer, digitsOf, type DigitTextProps } from "@/components/ui/digit-reserve";
import { Text } from "@/components/ui/text";

type Props = {
  /** The count and the target as written, in the reader's digits. */
  countText: string;
  targetText: string;
  textProps: DigitTextProps;
  opacity?: number;
  /** Test id of each reserved digit. */
  digitTestID: string;
};

/** A dhikr's count, as wide as its target so it holds its place as it grows. */
export const CountFigure = ({ countText, targetText, textProps, opacity, digitTestID }: Props) => (
  <>
    <View style={styles.reserve}>
      {[...targetText].map((character, place) => (
        <DigitSizer
          key={place}
          testID={digitTestID}
          digits={digitsOf(character) ?? character}
          textProps={textProps}
        />
      ))}
    </View>
    <Text {...textProps} opacity={opacity}>
      {countText}
    </Text>
  </>
);

const styles = StyleSheet.create({
  reserve: { flexDirection: "row" },
});
