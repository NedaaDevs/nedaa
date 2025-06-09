import { FC } from "react";

// Components
import { Pressable } from "@/components/ui/pressable";

// Icons
import { Play, Square } from "lucide-react-native";

type Props = {
  isPlaying: boolean;
  onPress: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
};

const SoundPreviewButton: FC<Props> = ({
  isPlaying,
  onPress,
  size = 20,
  color = "text-gray-600 dark:text-gray-400",
  disabled = false,
}) => {
  if (disabled) return null;

  return (
    <Pressable onPress={onPress} className="p-2" disabled={disabled}>
      {isPlaying ? (
        <Square size={size} className={color} fill="currentColor" />
      ) : (
        <Play size={size} className={color} fill="currentColor" />
      )}
    </Pressable>
  );
};

export default SoundPreviewButton;
