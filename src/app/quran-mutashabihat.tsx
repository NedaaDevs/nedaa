import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { QuranContentDB } from "@/services/quran-content-db";
import { MutashabihatGroup } from "@/types/mutashabihat";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { ReaderContentPage } from "@/components/quran/ReaderContentPage";
import { MutashabihatView } from "@/components/quran/sheets/MutashabihatView";

// Full page: the similar-verses (mutashabihat) comparison for one ayah — all
// members stacked with the shared phrase highlighted, plus the personal note.
// Tapping a member jumps the reader to it (leaving a "return" pill) and pops back.
const QuranMutashabihatScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const { surah, ayah } = useLocalSearchParams<{ surah: string; ayah: string }>();
  const surahNum = Number(surah);
  const ayahNum = Number(ayah);

  const quranTheme = useQuranStore((s) => s.quranTheme);
  const currentPage = useQuranStore((s) => s.currentPage);
  const setCurrentPage = useQuranStore((s) => s.setCurrentPage);
  const setFlashAyah = useQuranStore((s) => s.setFlashAyah);
  const setJumpReturn = useQuranStore((s) => s.setJumpReturn);
  const mutashabihatNotes = useQuranStore((s) => s.mutashabihatNotes);
  const setMutashabihatNote = useQuranStore((s) => s.setMutashabihatNote);

  const [group, setGroup] = useState<MutashabihatGroup | null>(null);
  useEffect(() => {
    if (!surahNum || !ayahNum) return;
    let cancelled = false;
    QuranContentDB.getMutashabihatGroupForAyah(surahNum, ayahNum).then((g) => {
      if (!cancelled) setGroup(g);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNum, ayahNum]);

  const RowChevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <ReaderContentPage title={t("quran.mutashabihat.title")}>
      {group ? (
        <MutashabihatView
          group={group}
          quranTheme={quranTheme}
          isArabic={i18n.language === "ar"}
          note={mutashabihatNotes[group.id] ?? ""}
          onChangeNote={(text) => setMutashabihatNote(group.id, text)}
          RowChevron={RowChevron}
          onGoTo={(s, a, page) => {
            setJumpReturn(currentPage);
            router.back();
            requestAnimationFrame(() => {
              setCurrentPage(page);
              setFlashAyah({ surah: s, ayah: a });
            });
          }}
        />
      ) : null}
    </ReaderContentPage>
  );
};

export default QuranMutashabihatScreen;
