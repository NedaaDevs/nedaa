import { View } from "tamagui";

import { Text } from "@/components/ui/text";
import { QURAN_FONT_FAMILY } from "@/constants/Quran";
import Frame from "@/components/quran/mihrab/Frame";

interface CartoucheProps {
  // Surah name, in the mushaf font.
  name: string;
  // Frame ink + the surface behind it (for the corner diamonds).
  color: `#${string}`;
  background: `#${string}`;
  // Name ink.
  textColor: `#${string}`;
  compact?: boolean;
  // The faint inner rule (off for the "minimal" surah-frame style).
  inner?: boolean;
}

// A framed surah-name band — the Mihrab `Frame` wrapped around the surah name.
const Cartouche = ({
  name,
  color,
  background,
  textColor,
  compact,
  inner = true,
}: CartoucheProps) => (
  <View alignItems="center">
    <Frame color={color} background={background} radius={14} padding={0} inner={inner}>
      <View paddingVertical={compact ? 8 : 12} paddingHorizontal={compact ? 22 : 28}>
        <Text
          style={{
            fontSize: compact ? 22 : 28,
            color: textColor,
            fontFamily: QURAN_FONT_FAMILY,
            textAlign: "center",
          }}>
          {name}
        </Text>
      </View>
    </Frame>
  </View>
);

export default Cartouche;
