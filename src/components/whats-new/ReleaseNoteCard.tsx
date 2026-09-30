import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { NUMBER_BADGE_STYLE, NumberBadge } from "@/components/ui/number-badge";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { WHATS_NEW_ACTION, type WhatsNewEntry } from "@/constants/WhatsNew";
import { formatNumberToLocale } from "@/utils/number";

/** Test ids for the card's parts; the card's own id ends with its entry's. */
export const RELEASE_NOTE_PART = {
  CARD: "release-note-card",
  TEXT: "release-note-text",
} as const;

type Props = {
  entry: WhatsNewEntry;
  /** Its place in the list shown, from one. */
  ordinal: number;
  onNavigate: (entry: WhatsNewEntry) => void;
  /** An opt-in entry is answered: turned on, or declined. */
  onSettled: (entry: WhatsNewEntry) => void;
};

type ActionProps = Omit<Props, "ordinal">;

/** The entry's way on: a screen to open, or a feature to turn on. */
const ReleaseNoteAction = ({ entry, onNavigate, onSettled }: ActionProps) => {
  const { t } = useTranslation();
  const { action } = entry;
  const [enabled, setEnabled] = useState(
    action.type === WHATS_NEW_ACTION.OPT_IN && action.isEnabled()
  );
  const [declined, setDeclined] = useState(false);
  const title = t(entry.titleKey);

  if (action.type === WHATS_NEW_ACTION.NAVIGATE) {
    return (
      <Pressable
        onPress={() => onNavigate(entry)}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.opens", { name: title })}
        alignSelf="flex-start"
        justifyContent="center">
        <Text size="sm" fontWeight="600" color="$accent">
          {t(action.ctaKey)}
        </Text>
      </Pressable>
    );
  }

  if (enabled) {
    return (
      <HStack
        gap="$1.5"
        alignItems="center"
        minHeight="$target"
        accessible
        accessibilityLabel={t("whatsNew.enabled")}>
        <Icon as={Check} size="sm" color="$accent" />
        <Text size="sm" fontWeight="600" color="$accent">
          {t("whatsNew.enabled")}
        </Text>
      </HStack>
    );
  }

  if (declined) return null;

  const enable = () => {
    action.enable();
    setEnabled(true);
    onSettled(entry);
  };
  const decline = () => {
    setDeclined(true);
    onSettled(entry);
  };

  return (
    <HStack gap="$4" alignItems="center">
      <Button
        action="primary"
        size="sm"
        onPress={enable}
        accessibilityLabel={t("a11y.whatsNew.enable", { title })}>
        <Button.Text>{t(action.ctaKey)}</Button.Text>
      </Button>
      <Pressable
        onPress={decline}
        accessibilityRole="button"
        accessibilityLabel={t("whatsNew.notNow")}
        justifyContent="center">
        <Text size="sm" color="$muted">
          {t("whatsNew.notNow")}
        </Text>
      </Pressable>
    </HStack>
  );
};

/** One release note: its place, what changed, and its way on. */
export const ReleaseNoteCard = ({ entry, ordinal, onNavigate, onSettled }: Props) => {
  const { t } = useTranslation();
  const title = t(entry.titleKey);
  const body = t(entry.descriptionKey);
  return (
    <HStack
      testID={`${RELEASE_NOTE_PART.CARD}-${entry.id}`}
      alignItems="flex-start"
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$card"
      backgroundColor="$surface2">
      {/* The text's label reads the place; the badge only draws it. */}
      <Box accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <NumberBadge n={ordinal} size="md" badgeStyle={NUMBER_BADGE_STYLE.FILLED} />
      </Box>
      <VStack flex={1}>
        <VStack
          testID={RELEASE_NOTE_PART.TEXT}
          accessible
          accessibilityLabel={t("a11y.whatsNew.entry", {
            n: formatNumberToLocale(String(ordinal)),
            title,
            body,
          })}>
          <Text size="sm" bold typography="title" color="$fg">
            {title}
          </Text>
          <Text size="xs" typography="helper" color="$muted">
            {body}
          </Text>
        </VStack>
        <ReleaseNoteAction entry={entry} onNavigate={onNavigate} onSettled={onSettled} />
      </VStack>
    </HStack>
  );
};
