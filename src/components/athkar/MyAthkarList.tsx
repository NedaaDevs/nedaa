import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { BookOpen, PenLine, Plus, Search } from "lucide-react-native";

import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TextAction } from "@/components/ui/text-action";
import { VStack } from "@/components/ui/vstack";
import { CUSTOM_ATHKAR_HREF } from "@/constants/Athkar";
import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import { SECTION_KIND } from "@/constants/Section";
import { AppLocale } from "@/enums/app";
import { useInitializeAthkarStores } from "@/hooks/useInitializeAthkarStores";
import { useRatioText } from "@/hooks/useRatioText";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { groupMyAthkarByCategory, useMyAthkarStore } from "@/stores/my-athkar";

type Props = {
  /** Opens a collection as a session. */
  onOpen: (source: CollectionSource) => void;
};

/** My Athkar: Hisn al-Muslim search, the saved groups, a new group. */
const MyAthkarList = ({ onOpen }: Props) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const ratioText = useRatioText();
  const { isMyAthkarInit, isCustomInit } = useInitializeAthkarStores();

  const hisnItems = useMyAthkarStore((s) => s.items);
  const hisnProgress = useMyAthkarStore((s) => s.progress);
  const hisnDisplayData = useMyAthkarStore((s) => s.displayData);
  const customGroups = useCustomAthkarStore((s) => s.groups);
  const customItems = useCustomAthkarStore((s) => s.items);
  const customProgress = useCustomAthkarStore((s) => s.progress);

  const [searching, setSearching] = useState(false);

  // Grouping builds a fresh array, so it is memoized, not selected.
  const hisnGroups = useMemo(
    () => groupMyAthkarByCategory(hisnItems, hisnDisplayData),
    [hisnItems, hisnDisplayData]
  );

  if (!isMyAthkarInit || !isCustomInit) {
    return (
      <Text size="label" color="$muted">
        {t("athkar.loading.initializing")}
      </Text>
    );
  }

  const groupCount = hisnGroups.length + customGroups.length;
  const today = (done: number, total: number) => ({
    status: ratioText(done, total),
    spokenStatus: t("a11y.customAthkar.cardProgress", { current: done, total }),
  });

  return (
    <VStack gap="$section">
      <HStack alignItems="flex-end" gap="$stack">
        <VStack flex={1} gap="$tight">
          <Text size="headline" bold typography="title" color="$fg" accessibilityRole="header">
            {t("athkar.myAthkar")}
          </Text>
          <Text size="label" color="$muted">
            {t("athkar.library.subtitle")}
          </Text>
        </VStack>
        {groupCount > 0 ? (
          // Its own box, so the row aligns it to the bottom, not the centre.
          <Box>
            <Pill>{t("athkar.library.groups", { count: groupCount })}</Pill>
          </Box>
        ) : null}
      </HStack>

      <ListRow
        variant={LIST_ROW_VARIANT.CARD}
        icon={Search}
        tile
        title={t("athkar.library.searchHisn")}
        status={t("athkar.library.searchHisnHint")}
        onPress={() => setSearching(true)}
      />

      <Section
        title={t("athkar.library.saved")}
        kind={SECTION_KIND.LABEL}
        accessory={
          groupCount > 0 ? (
            <Text size="helper" color="$muted">
              {t("athkar.library.today")}
            </Text>
          ) : undefined
        }>
        {groupCount === 0 ? (
          <Text size="label" color="$muted">
            {t("athkar.library.empty")}
          </Text>
        ) : (
          <ListGroup>
            {hisnGroups.map((group) => {
              const done = group.items.filter(
                (item) => hisnProgress.find((p) => p.myAthkarId === item.id)?.completed
              ).length;
              return (
                <ListRow
                  key={`hisn-${group.categoryId}`}
                  variant={LIST_ROW_VARIANT.GROUPED}
                  icon={BookOpen}
                  tile
                  title={i18n.language === AppLocale.AR ? group.titleAr : group.titleEn}
                  {...today(done, group.items.length)}
                  onPress={() =>
                    onOpen({ kind: SESSION_SOURCE.HISN, categoryId: group.categoryId })
                  }
                />
              );
            })}
            {customGroups.map((group) => {
              const ids = new Set(
                customItems.filter((i) => i.groupId === group.id).map((i) => i.id)
              );
              const done = customProgress.filter(
                (p) => ids.has(p.customItemId) && p.completed
              ).length;
              return (
                <ListRow
                  key={`custom-${group.id}`}
                  variant={LIST_ROW_VARIANT.GROUPED}
                  icon={PenLine}
                  tile
                  title={group.title}
                  {...today(done, ids.size)}
                  value={t("athkar.library.custom")}
                  onPress={() => onOpen({ kind: SESSION_SOURCE.CUSTOM, groupId: group.id })}
                />
              );
            })}
          </ListGroup>
        )}
      </Section>

      <HStack justifyContent="center">
        <TextAction
          label={t("athkar.library.createGroup")}
          icon={Plus}
          onPress={() => router.push(CUSTOM_ATHKAR_HREF.NEW)}
        />
      </HStack>

      <AthkarSearchSheet isOpen={searching} onClose={() => setSearching(false)} />
    </VStack>
  );
};

export default MyAthkarList;
