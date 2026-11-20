import { useTranslation } from "react-i18next";

import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { groupMyAthkarByCategory, useMyAthkarStore } from "@/stores/my-athkar";

/** A collection's name; null when it holds no dhikr or is gone. */
export const useCollectionTitle = (source: CollectionSource | null): string | null => {
  const { i18n } = useTranslation();
  const hisnItems = useMyAthkarStore((s) => s.items);
  const hisnTexts = useMyAthkarStore((s) => s.displayData);
  const customGroups = useCustomAthkarStore((s) => s.groups);

  if (!source) return null;
  switch (source.kind) {
    case SESSION_SOURCE.HISN: {
      const topic = groupMyAthkarByCategory(hisnItems, hisnTexts).find(
        (group) => group.categoryId === source.categoryId
      );
      if (!topic) return null;
      return i18n.language === AppLocale.AR ? topic.titleAr : topic.titleEn;
    }
    case SESSION_SOURCE.CUSTOM:
      return customGroups.find((group) => group.id === source.groupId)?.title ?? null;
  }
};
