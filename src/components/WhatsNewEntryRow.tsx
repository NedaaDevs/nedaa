import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import type { WhatsNewEntry } from "@/constants/WhatsNew";

type Props = {
  entry: WhatsNewEntry;
  onNavigate: (entry: WhatsNewEntry) => void;
  onSettled?: (entry: WhatsNewEntry) => void;
};

const WhatsNewEntryRow = ({ entry, onNavigate, onSettled }: Props) => {
  const { t } = useTranslation();
  const { action } = entry;
  const [enabled, setEnabled] = useState(action.type === "optIn" ? action.isEnabled() : false);
  const [declined, setDeclined] = useState(false);

  const handleEnable = () => {
    if (action.type !== "optIn" || enabled) return;
    action.enable();
    setEnabled(true);
    onSettled?.(entry);
  };

  const handleDecline = () => {
    setDeclined(true);
    onSettled?.(entry);
  };

  return (
    <HStack gap="$3" alignItems="flex-start">
      <Box
        width={40}
        height={40}
        borderRadius="$3"
        backgroundColor="$backgroundInteractive"
        alignItems="center"
        justifyContent="center">
        <Icon as={entry.icon} size="md" color="$accentPrimary" />
      </Box>
      <VStack flex={1} gap="$1">
        <Text size="sm" fontWeight="600" color="$typography">
          {t(entry.titleKey)}
        </Text>
        <Text size="xs" color="$typographySecondary" lineHeight={18}>
          {t(entry.descriptionKey)}
        </Text>

        {action.type === "navigate" ? (
          <Pressable
            onPress={() => onNavigate(entry)}
            minHeight={44}
            justifyContent="center"
            alignSelf="flex-start"
            accessibilityRole="button"
            accessibilityLabel={t(action.ctaKey)}>
            <Text size="sm" fontWeight="600" color="$accentPrimary">
              {t(action.ctaKey)}
            </Text>
          </Pressable>
        ) : declined ? (
          <Text size="sm" color="$typographySecondary" paddingVertical="$2">
            {t("whatsNew.notNow")}
          </Text>
        ) : (
          <HStack gap="$4" alignItems="center">
            <Pressable
              onPress={handleEnable}
              minHeight={44}
              minWidth={44}
              paddingHorizontal="$4"
              justifyContent="center"
              alignItems="center"
              borderRadius="$3"
              backgroundColor={enabled ? "$backgroundInteractive" : "$accentPrimary"}
              accessibilityRole="button"
              accessibilityLabel={t(enabled ? "whatsNew.enabled" : action.ctaKey)}
              accessibilityState={{ selected: enabled, disabled: enabled }}>
              <HStack gap="$1.5" alignItems="center">
                {enabled && <Icon as={Check} size="sm" color="$accentPrimary" />}
                <Text size="sm" fontWeight="600" color={enabled ? "$accentPrimary" : "white"}>
                  {t(enabled ? "whatsNew.enabled" : action.ctaKey)}
                </Text>
              </HStack>
            </Pressable>
            {!enabled && (
              <Pressable
                onPress={handleDecline}
                minHeight={44}
                justifyContent="center"
                accessibilityRole="button"
                accessibilityLabel={t("whatsNew.notNow")}>
                <Text size="sm" color="$typographySecondary">
                  {t("whatsNew.notNow")}
                </Text>
              </Pressable>
            )}
          </HStack>
        )}
      </VStack>
    </HStack>
  );
};

export default WhatsNewEntryRow;
