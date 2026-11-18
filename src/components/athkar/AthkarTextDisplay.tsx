import { FC, ComponentProps } from "react";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { useDhikrText } from "@/hooks/useDhikrText";
import type { DhikrText } from "@/utils/athkarText";

type Props = {
  text: DhikrText;
  size?: "sm" | "md" | "lg" | "xl" | "headline" | "2xl" | "heading";
  fontWeight?: ComponentProps<typeof Text>["fontWeight"];
  textAlign?: "left" | "center" | "right";
  color?: ComponentProps<typeof Text>["color"];
};

const ARABIC_LINE_HEIGHT: Record<string, number> = {
  sm: 22,
  md: 26,
  lg: 30,
  xl: 34,
  headline: 44,
  "2xl": 40,
  heading: 52,
};

const AthkarTextDisplay: FC<Props> = ({
  text,
  size = "xl",
  textAlign = "center",
  color = "$typography",
  fontWeight,
}) => {
  const { words, showTranslation } = useDhikrText();
  const { arabic, translation } = words(text);

  return (
    <VStack gap="$3" alignItems={textAlign === "center" ? "center" : undefined}>
      <Text
        size={size}
        textAlign={textAlign}
        color={color}
        fontWeight={fontWeight}
        lineHeight={ARABIC_LINE_HEIGHT[size] ?? 34}
        style={{ writingDirection: "rtl" }}>
        {arabic}
      </Text>
      {translation && showTranslation && (
        <Text size="sm" textAlign={textAlign} color="$typographySecondary" lineHeight={20}>
          {translation}
        </Text>
      )}
    </VStack>
  );
};

export default AthkarTextDisplay;
