import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MushafVersion, QuranTheme, LineType } from "@/enums/quran";
import { LINES_PER_PAGE } from "@/constants/Quran";
import { QuranDB } from "@/services/quran-db";
import LineImage from "@/components/quran/LineImage";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
}

const QuranPage = ({ page, version, quranTheme }: QuranPageProps) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [surahName, setSurahName] = useState("");
  const [juz, setJuz] = useState(1);

  useEffect(() => {
    const loadPageData = async () => {
      const [lineMetadata, juzNumber] = await Promise.all([
        QuranDB.getLineMetadata(version, page),
        QuranDB.getJuzForPage(page),
      ]);

      const surahHeader = lineMetadata.find(
        (lm) => lm.type === LineType.SURAH_HEADER && lm.surahName
      );
      if (surahHeader?.surahName) {
        setSurahName(surahHeader.surahName);
      }
      setJuz(juzNumber);
    };

    loadPageData();
  }, [page, version]);

  const lines = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

  return (
    <YStack flex={1} width={width} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <PageHeader surahName={surahName} juz={juz} quranTheme={quranTheme} />

      <YStack flex={1} justifyContent="center">
        {lines.map((line) => (
          <LineImage
            key={`${page}-${line}`}
            version={version}
            page={page}
            line={line}
            screenWidth={width}
            quranTheme={quranTheme}
          />
        ))}
      </YStack>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranPage;
