import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react-native";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { MessageToast } from "@/components/feedback";
import {
  Actionsheet,
  ActionsheetCloseButton,
  ActionsheetContent,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DHIKR_TEXT } from "@/constants/AthkarSession";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useRTL } from "@/contexts/RTLContext";
import { useDhikrText } from "@/hooks/useDhikrText";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText } from "@/hooks/useRatioText";
import { useMyAthkarStore } from "@/stores/my-athkar";
import type { HisnAthkar } from "@/types/hisnMuslim";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar");

/** Test ids for the parts a test reaches. */
export const COLLECTION_EDIT_PART = {
  ROW: "collection-edit-row",
  REMOVE: "collection-edit-remove",
  DETAIL: "collection-edit-detail",
} as const;

/** The sheet's one detent, as a share of the screen's height. */
const SNAP = [76];
/** Twice the text size: Arabic marks clear the line box. */
const ROW_LINE_HEIGHT = 32;

const Labelled = ({ label, children }: { label: string; children: string }) => (
  <VStack gap="$1">
    <Text size="helper" fontWeight="600" color="$muted">
      {label}
    </Text>
    <Text size="md" color="$fg">
      {children}
    </Text>
  </VStack>
);

/** One dhikr in full: its words, how they are said and what they mean. */
const Detail = ({ dhikr }: { dhikr: HisnAthkar }) => {
  const { t } = useTranslation();
  return (
    <VStack testID={COLLECTION_EDIT_PART.DETAIL} gap="$4" paddingVertical="$2">
      <AthkarTextDisplay
        text={{ kind: DHIKR_TEXT.RAW, arabic: dhikr.arabicText, translation: null }}
        size="xl"
        color="$fg"
      />
      {dhikr.transliteration ? (
        <Labelled label={t("athkar.myAthkar.transliteration")}>{dhikr.transliteration}</Labelled>
      ) : null}
      {dhikr.translation ? (
        <Labelled label={t("athkar.myAthkar.translation")}>{dhikr.translation}</Labelled>
      ) : null}
    </VStack>
  );
};

type Props = {
  open: boolean;
  /** The saved topic of Hisn al-Muslim the sheet edits. */
  categoryId: number;
  onClose: () => void;
};

/** A saved topic's dhikr: each opens in full, and each can leave the collection. */
export const CollectionEditSheet = ({ open, categoryId, onClose }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const countText = useCountText();
  const warn = useHaptic(HAPTIC_FEEDBACK.WARNING);
  const items = useMyAthkarStore((s) => s.items);
  const texts = useMyAthkarStore((s) => s.displayData);
  const removeItem = useMyAthkarStore((s) => s.removeItem);
  const { line } = useDhikrText();
  const [viewing, setViewing] = useState<number | null>(null);

  const rows = items
    .filter((item) => item.sourceCategoryId === categoryId)
    .flatMap((item) => {
      const dhikr = texts.get(item.sourceAthkarId);
      if (!dhikr) return [];
      // Named as the session's list names it.
      const name = line({
        kind: DHIKR_TEXT.RAW,
        arabic: dhikr.arabicText,
        translation: dhikr.translation,
      });
      return [{ id: item.id, dhikr, name }];
    });
  const viewed = rows.find((row) => row.id === viewing);
  // Back points to the start edge.
  const Chevron = isRTL ? ChevronRight : ChevronLeft;

  const close = () => {
    setViewing(null);
    onClose();
  };

  const remove = async (id: number) => {
    const removed = await removeItem(id).catch((error: unknown) => {
      log.e(
        "Library",
        "the dhikr was not removed",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    });
    if (!removed) MessageToast.showError(t("athkar.collection.removeFailed"));
  };

  return (
    <Actionsheet isOpen={open} onClose={close} snapPoints={SNAP}>
      <ActionsheetContent>
        <VStack gap="$2">
          <HStack alignItems="center" gap="$2">
            {viewed ? (
              <Pressable
                minWidth="$target"
                minHeight="$target"
                alignItems="center"
                justifyContent="center"
                marginStart="$-2.5"
                accessibilityLabel={t("common.back")}
                onPress={() => setViewing(null)}>
                <Icon as={Chevron} size="lg" color="$accent" />
              </Pressable>
            ) : null}
            <Box flex={1}>
              <ActionsheetTitle>
                <Text size="lg" bold typography="title" color="$fg">
                  {t("athkar.collection.edit")}
                </Text>
              </ActionsheetTitle>
            </Box>
            <ActionsheetCloseButton onPress={close} />
          </HStack>
          {viewed ? (
            <Detail dhikr={viewed.dhikr} />
          ) : (
            <VStack>
              {rows.map(({ id, name }, i) => (
                <HStack key={id} alignItems="center" gap="$2">
                  <Pressable
                    testID={COLLECTION_EDIT_PART.ROW}
                    flex={1}
                    minWidth={0}
                    minHeight="$14"
                    justifyContent="center"
                    paddingHorizontal="$3"
                    borderRadius="$control"
                    pressStyle={{ opacity: 1, backgroundColor: "$pressed" }}
                    accessibilityLabel={name}
                    onPress={() => setViewing(id)}>
                    <Text
                      size="lg"
                      fontWeight="500"
                      lineHeight={ROW_LINE_HEIGHT}
                      color="$fg"
                      isTruncated>
                      {name}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={COLLECTION_EDIT_PART.REMOVE}
                    minWidth="$target"
                    minHeight="$target"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$pill"
                    pressStyle={{ opacity: 1, backgroundColor: "$pressed" }}
                    accessibilityLabel={t("a11y.athkar.removeDhikr", { number: countText(i + 1) })}
                    onPress={() => {
                      warn();
                      void remove(id);
                    }}>
                    <Icon as={Trash2} size="md" color="$muted" />
                  </Pressable>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
