import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

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
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Pressable } from "@/components/ui/pressable";
import { SearchField } from "@/components/ui/search-field";
import { Section } from "@/components/ui/section";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Text } from "@/components/ui/text";
import { Face } from "@/components/ui/text/face";
import { TextAction } from "@/components/ui/text-action";
import { VStack } from "@/components/ui/vstack";
import { FONT_LANGUAGE } from "@/constants/Fonts";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SECTION_KIND } from "@/constants/Section";
import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { AppLocale } from "@/enums/app";
import { useHaptic } from "@/hooks/useHaptic";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { HisnMuslimDB } from "@/services/hisn-muslim-db";
import { useMyAthkarStore } from "@/stores/my-athkar";
import type { HisnAthkar, HisnCategory } from "@/types/hisnMuslim";
import { cutPreview } from "@/utils/previewText";

/** Typing settles this long before the search runs. */
const SEARCH_DELAY_MS = 300;
const CHECK_SIZE = 23;
/** A dhikr's preview in a list: enough to tell it apart. */
const PREVIEW_LINES = 2;
/** Vowelled Arabic cut short of two lines at a word, so the clamp never ellipsizes it. */
const ARABIC_PREVIEW_CHARS = 60;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type DhikrChoiceProps = {
  text: string;
  /** The text is the Arabic original, set in its own face and direction. */
  arabic: boolean;
  meta: string;
  checked: boolean;
  /** Already in My Athkar: drawn checked, not choosable. */
  added: boolean;
  onPress: () => void;
};

/** One dhikr to choose: its text, how often it is said and where it is from. */
const DhikrChoice = ({ text, arabic, meta, checked, added, onPress }: DhikrChoiceProps) => {
  const { t } = useTranslation();
  const named = t("a11y.join", { first: text, second: meta });
  const body = (
    <Text
      size="md"
      fontWeight="600"
      color="$fg"
      typography={arabic ? "vowelled" : undefined}
      numberOfLines={PREVIEW_LINES}
      style={arabic ? { writingDirection: "rtl" } : undefined}>
      {arabic ? cutPreview(text, ARABIC_PREVIEW_CHARS) : text}
    </Text>
  );

  return (
    <Pressable
      onPress={added ? undefined : onPress}
      disabled={added}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: added }}
      accessibilityLabel={
        added ? t("a11y.join", { first: named, second: t("athkar.myAthkar.alreadyAdded") }) : named
      }
      flexDirection="row"
      alignItems="flex-start"
      gap="$stack"
      minHeight="$target"
      paddingHorizontal="$3.5"
      paddingVertical="$stack"
      pressStyle={{ backgroundColor: "$pressed", opacity: 1 }}>
      <Box
        width={CHECK_SIZE}
        height={CHECK_SIZE}
        marginTop="$0.5"
        borderRadius="$chip"
        borderWidth={1.5}
        borderColor={checked ? "$accent" : "$muted"}
        backgroundColor={checked ? "$accent" : "transparent"}
        opacity={added ? 0.5 : 1}
        alignItems="center"
        justifyContent="center">
        {checked ? <Icon as={Check} size={14} color="$bg" strokeWidth={2.4} /> : null}
      </Box>
      <VStack flex={1} gap="$tight">
        {arabic ? <Face language={FONT_LANGUAGE.ARABIC}>{body}</Face> : body}
        <Text size="helper" color="$muted">
          {added
            ? t("a11y.join", { first: meta, second: t("athkar.myAthkar.alreadyAdded") })
            : meta}
        </Text>
      </VStack>
    </Pressable>
  );
};

/** Hisn al-Muslim by topic or by search, to add chosen athkar to My Athkar. */
const AthkarSearchSheet = ({ isOpen, onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const items = useMyAthkarStore((s) => s.items);
  const batchAddItems = useMyAthkarStore((s) => s.batchAddItems);
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const selection = useHaptic(HAPTIC_FEEDBACK.SELECTION);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HisnAthkar[] | null>(null);
  const [topics, setTopics] = useState<HisnCategory[]>([]);
  const [topic, setTopic] = useState<HisnCategory | null>(null);
  const [topicAthkar, setTopicAthkar] = useState<HisnAthkar[]>([]);
  const [chosen, setChosen] = useState<ReadonlyMap<number, HisnAthkar>>(new Map());
  const [adding, setAdding] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);

  const arabicUi = i18n.language === AppLocale.AR;
  const topicTitle = (titles: Pick<HisnCategory, "titleAr" | "titleEn">) =>
    arabicUi ? titles.titleAr : titles.titleEn;
  const topicNames = useMemo(() => new Map(topics.map((c) => [c.id, c])), [topics]);
  const added = useMemo(() => new Set(items.map((item) => item.sourceAthkarId)), [items]);

  useEffect(() => {
    if (isOpen && topics.length === 0) void HisnMuslimDB.getCategories().then(setTopics);
  }, [isOpen, topics.length]);

  useEffect(() => () => clearTimeout(pending.current ?? undefined), []);

  // Closing resets the sheet in the same call, so the next opening starts fresh
  // even when the parent keeps it mounted.
  /** Clears a waiting search and orphans one already reading the database. */
  const cancelSearch = () => {
    clearTimeout(pending.current ?? undefined);
    request.current += 1;
  };

  const close = () => {
    cancelSearch();
    setQuery("");
    setResults(null);
    setTopic(null);
    setChosen(new Map());
    onClose();
  };

  const search = (next: string) => {
    setQuery(next);
    cancelSearch();
    const trimmed = next.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    const ticket = request.current;
    pending.current = setTimeout(async () => {
      const found = await HisnMuslimDB.search(trimmed);
      // A later keystroke, a cleared field or a close owns the list now.
      if (request.current === ticket) setResults(found);
    }, SEARCH_DELAY_MS);
  };

  const openTopic = async (next: HisnCategory) => {
    setTopic(next);
    setTopicAthkar([]);
    setTopicAthkar(await HisnMuslimDB.getCategoryAthkar(next.id));
  };

  const toggle = (item: HisnAthkar) => {
    void selection();
    setChosen((prev) => {
      const next = new Map(prev);
      if (!next.delete(item.id)) next.set(item.id, item);
      return next;
    });
  };

  // A second tap while the write runs would add every dhikr twice.
  const run = useSingleFlight();
  const add = () =>
    run(async () => {
      const picked = [...chosen.values()];
      setAdding(true);
      const ok = await batchAddItems(
        picked.map((item) => ({
          sourceAthkarId: item.id,
          sourceCategoryId: item.categoryId,
          repeatCount: item.repeatCount,
        }))
      );
      setAdding(false);
      if (!ok) {
        MessageToast.showError(t("athkar.library.addFailed"));
        return;
      }
      void success();
      MessageToast.showSuccess(t("athkar.library.added", { count: picked.length }));
      close();
    });

  /** A search result names its topic; a topic's own list does not repeat it. */
  const choiceFor = (item: HisnAthkar, withTopic: boolean) => {
    const translated = !arabicUi && item.translation !== "";
    const source = withTopic ? topicNames.get(item.categoryId) : undefined;
    const repeats = t("athkar.library.repeats", { count: item.repeatCount });
    const isAdded = added.has(item.id);
    return (
      <DhikrChoice
        key={item.id}
        text={translated ? item.translation : item.arabicText}
        arabic={!translated}
        meta={source ? `${repeats} · ${topicTitle(source)}` : repeats}
        checked={isAdded || chosen.has(item.id)}
        added={isAdded}
        onPress={() => toggle(item)}
      />
    );
  };

  const body = () => {
    if (results !== null) {
      return results.length === 0 ? (
        <Text size="label" color="$muted" textAlign="center" paddingVertical="$section">
          {t("athkar.myAthkar.noResults")}
        </Text>
      ) : (
        <Section title={t("athkar.myAthkar.searchResults")} kind={SECTION_KIND.LABEL}>
          <ListGroup>{results.map((item) => choiceFor(item, true))}</ListGroup>
        </Section>
      );
    }
    if (query.trim()) return null;
    if (topic) {
      return (
        <Section
          title={topicTitle(topic)}
          kind={SECTION_KIND.LABEL}
          accessory={
            <TextAction label={t("athkar.library.allTopics")} onPress={() => setTopic(null)} />
          }>
          <ListGroup>{topicAthkar.map((item) => choiceFor(item, false))}</ListGroup>
        </Section>
      );
    }
    return (
      <Section title={t("athkar.library.browse")} kind={SECTION_KIND.LABEL}>
        <ListGroup>
          {topics.map((item) => (
            <ListRow
              key={item.id}
              variant={LIST_ROW_VARIANT.GROUPED}
              title={topicTitle(item)}
              onPress={() => void openTopic(item)}
            />
          ))}
        </ListGroup>
      </Section>
    );
  };

  const footer =
    chosen.size > 0 ? (
      // The sheet's own surface, so rows never show through the bar.
      <Box backgroundColor="$raised" onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
        <StickyActionBar
          state={adding ? STICKY_ACTION_STATE.BUSY : STICKY_ACTION_STATE.READY}
          label={t("athkar.library.addSelected", { count: chosen.size })}
          busyStatus={t("athkar.library.adding")}
          onPress={() => void add()}
        />
      </Box>
    ) : undefined;

  return (
    <Actionsheet isOpen={isOpen} onClose={close} snapPoints={[85]} footer={footer}>
      <ActionsheetContent>
        <VStack gap="$group" paddingBottom={footer ? footerHeight : 0}>
          <HStack alignItems="center" justifyContent="space-between" gap="$stack">
            <ActionsheetTitle>
              <Text size="lg" bold typography="title" color="$fg">
                {t("athkar.library.searchHisn")}
              </Text>
            </ActionsheetTitle>
            <ActionsheetCloseButton onPress={close} />
          </HStack>
          <SearchField
            value={query}
            onChangeText={search}
            placeholder={t("athkar.myAthkar.search")}
          />
          {body()}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AthkarSearchSheet;
