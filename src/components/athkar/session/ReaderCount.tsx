import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import type { AthkarReader } from "@/hooks/useAthkarReader";

type ReaderCountProps = Pick<AthkarLookProps, "session"> & { reader: AthkarReader };

/** The count against its target, or why it cannot count, beside undo. */
export const ReaderCount = ({ reader, session }: ReaderCountProps) => {
  const { t } = useTranslation();
  const { current } = reader;
  const closed = current.audioOwnsCount || current.done;
  return (
    <HStack minHeight="$target" alignItems="center" justifyContent="center" gap="$2">
      {closed ? (
        <Text size="lg" fontWeight="500" color="$mutedSky" textAlign="center" flexShrink={1}>
          {reader.hint}
        </Text>
      ) : (
        <HStack alignItems="baseline" gap="$1.5">
          <Text size="lg" fontWeight="600" color="$fg" numeric>
            {reader.countText}
          </Text>
          <Text size="lg" fontWeight="500" color="$mutedSky" numeric>
            {t("athkar.focus.ofTarget", { target: reader.targetText })}
          </Text>
        </HStack>
      )}
      <Button
        action="primary"
        variant="link"
        flexShrink={0}
        disabled={!session.canUndo}
        onPress={session.undo}>
        <Button.Text>{t("athkar.session.undo")}</Button.Text>
      </Button>
    </HStack>
  );
};
