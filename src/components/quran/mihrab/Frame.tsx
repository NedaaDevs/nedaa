import { ReactNode } from "react";
import { View } from "tamagui";

interface FrameProps {
  children?: ReactNode;
  // Border + corner-diamond ink: the paper `frameColor` in the reader, or the
  // app accent on chrome surfaces.
  color: `#${string}`;
  // Surface the frame sits on, painted behind the corner diamonds so they read
  // as cut into the border rather than floating.
  background: `#${string}`;
  radius?: number;
  padding?: number;
  // The faint inner double-rule (disable for the "minimal" surah-frame style).
  inner?: boolean;
}

// The Mihrab motif: a hairline manuscript border with a faint inner rule and a
// small diamond at each corner. One device reused across the feature so every
// surface reads as a single mushaf.
const DIAMOND = 7;
const HALF = DIAMOND / 2;

const Frame = ({
  children,
  color,
  background,
  radius = 16,
  padding = 14,
  inner = true,
}: FrameProps) => {
  const corners = [
    { top: -HALF, left: -HALF },
    { top: -HALF, right: -HALF },
    { bottom: -HALF, left: -HALF },
    { bottom: -HALF, right: -HALF },
  ];
  return (
    <View
      position="relative"
      padding={padding}
      borderRadius={radius}
      borderWidth={1.5}
      borderColor={color}>
      {inner && (
        <View
          position="absolute"
          top={4}
          left={4}
          right={4}
          bottom={4}
          borderRadius={Math.max(0, radius - 4)}
          borderWidth={0.75}
          borderColor={color}
          opacity={0.45}
          pointerEvents="none"
        />
      )}
      {corners.map((pos, i) => (
        <View
          key={i}
          position="absolute"
          width={DIAMOND}
          height={DIAMOND}
          backgroundColor={background}
          borderWidth={1.5}
          borderColor={color}
          rotate="45deg"
          {...pos}
        />
      ))}
      <View position="relative">{children}</View>
    </View>
  );
};

export default Frame;
