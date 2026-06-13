import { Platform } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { LucideIcon } from "lucide-react-native";

interface ReaderIconProps {
  // SF Symbol name used on iOS; lucide component used as the Android fallback.
  sf: SFSymbol;
  lucide: LucideIcon;
  size?: number;
  color: string;
}

// Reader-chrome icon: a native SF Symbol on iOS, the matching lucide glyph on
// Android. Keeps the reader feeling native on iOS without an Android gap.
const ReaderIcon = ({ sf, lucide: Lucide, size = 22, color }: ReaderIconProps) => {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={sf}
        size={size}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Lucide size={size} color={color} />;
};

export default ReaderIcon;
