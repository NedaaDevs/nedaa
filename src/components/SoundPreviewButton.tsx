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
  color = "text-typography-secondary",
  disabled = false,
}) => {
  if (disabled) return null;

  return (
    <Pressable onPress={onPress} className="p-2" disabled={disabled}>
      {isPlaying ? (
        <Icon size={size} className={color} as={Square} />
      ) : (
        <Icon size={size} className={color} as={Play} />
      )}
    </Pressable>
  );
};

export default SoundPreviewButton;
