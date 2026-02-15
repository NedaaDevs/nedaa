import { FC, ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { useAthkarStore } from "@/stores/athkar";
import { splitAthkarText } from "@/utils/athkarText";

type Props = {
  textKey: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  textAlign?: "left" | "center" | "right";
  color?: ComponentProps<typeof Text>["color"];
};

const ARABIC_LINE_HEIGHT: Record<string, number> = {
  sm: 22,
  md: 26,
  lg: 30,
  xl: 34,
  "2xl": 40,
};

const AthkarTextDisplay: FC<Props> = ({
  textKey,
  size = "xl",
  textAlign = "center",
  color = "$typography",
}) => {
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);
  const locale = i18n.language;

  const rawText = t(textKey);
  const { arabic, translation } = splitAthkarText(rawText, locale);

  return (
    <VStack gap="$3" alignItems={textAlign === "center" ? "center" : undefined}>
      <Text
        size={size}
        textAlign={textAlign}
        color={color}
        style={{ lineHeight: ARABIC_LINE_HEIGHT[size] ?? 34, writingDirection: "rtl" }}>
        {arabic}
      </Text>
      {translation && showTranslation && (
        <Text
          size="sm"
          textAlign={textAlign}
          color="$typographySecondary"
          style={{ lineHeight: 20 }}>
          {translation}
        </Text>
      )}
    </VStack>
  );
};

export default AthkarTextDisplay;
