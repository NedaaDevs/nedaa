import { Text } from "react-native";

/** The test id a stand-in glyph renders with. */
export const GLYPH_ID = "glyph";

/** Stands in for a lucide glyph and shows the colour it was handed. */
export const Glyph = ({ color }: { color?: string }) => <Text testID={GLYPH_ID}>{color}</Text>;
