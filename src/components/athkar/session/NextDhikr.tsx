import { useTranslation } from "react-i18next";

import { HStack, type HStackProps } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { useAthkarStore } from "@/stores/athkar";
import { athkarLine } from "@/utils/athkarText";

/** Twice the text size: Arabic marks clear the line box. */
const LINE_HEIGHT = 28;

type NextDhikrProps = HStackProps & {
  /** Null on the last open dhikr. */
  next: { textKey: string } | null;
  color: React.ComponentProps<typeof Text>["color"];
};

/** One line: the dhikr that opens next, or that this one is the last. */
export const NextDhikr = ({ next, color, ...row }: NextDhikrProps) => {
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);

  return (
    <HStack alignItems="center" gap="$2" paddingHorizontal="$4" {...row}>
      {next ? (
        <>
          <Text size="md" fontWeight="600" color={color}>
            {t("athkar.focus.next")}
          </Text>
          <Text
            size="md"
            fontWeight="500"
            lineHeight={LINE_HEIGHT}
            color={color}
            flexShrink={1}
            isTruncated>
            {athkarLine(t(next.textKey), i18n.language, showTranslation)}
          </Text>
        </>
      ) : (
        <Text size="md" fontWeight="500" color={color}>
          {t("athkar.session.lastThikr")}
        </Text>
      )}
    </HStack>
  );
};
