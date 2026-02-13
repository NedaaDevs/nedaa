import { FC } from "react";

// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Play, Square } from "lucide-react-native";

type Props = {
  isPlaying: boolean;
  onPress: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  disabled?: boolean;
};

const SoundPreviewButton: FC<Props> = ({
  isPlaying,
  onPress,
  size = "lg",
  color = "$typographySecondary",
  disabled = false,
}) => {
  if (disabled) return null;

  return (
    <Pressable
      onPress={onPress}
      padding="$2"
      disabled={disabled}
      minHeight={44}
      minWidth={44}
      alignItems="center"
      justifyContent="center"
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Stop" : "Play"}>
      {isPlaying ? (
        <Icon size={size} color={color} as={Square} />
      ) : (
        <Icon size={size} color={color} as={Play} />
      )}
    </Pressable>
  );
};

export default SoundPreviewButton;
