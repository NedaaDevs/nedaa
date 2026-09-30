import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ReleaseNoteCard } from "@/components/whats-new/ReleaseNoteCard";
import type { WhatsNewEntry } from "@/constants/WhatsNew";

type Props = {
  entries: readonly WhatsNewEntry[];
  onNavigate: (entry: WhatsNewEntry) => void;
  onSettled: (entry: WhatsNewEntry) => void;
};

/** The entries as numbered cards, or a line saying none applies. */
export const ReleaseNotesList = ({ entries, onNavigate, onSettled }: Props) => {
  const { t } = useTranslation();
  if (entries.length === 0) {
    return (
      <Text size="sm" typography="helper" color="$muted" textAlign="center" paddingVertical="$6">
        {t("whatsNew.empty")}
      </Text>
    );
  }
  return (
    <VStack gap="$2">
      {entries.map((entry, i) => (
        <ReleaseNoteCard
          key={entry.id}
          entry={entry}
          ordinal={i + 1}
          onNavigate={onNavigate}
          onSettled={onSettled}
        />
      ))}
    </VStack>
  );
};
