import { useEffect, useMemo, useState } from "react";
import { Image } from "react-native";
import { Paths } from "expo-file-system";

import { LineType, MushafImageType, MushafVersion } from "@/enums/quran";
import { GlyphBound } from "@/types/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { juzForPage } from "@/utils/juz";
import { QuranDownload } from "@/services/quran-download";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-content-db");

// page → rub (hizb-quarter, 1..240) that STARTS on it. Boundaries are fixed for
// the 604-page layout, so the DB is asked once per session and every page after
// that is a synchronous map lookup. The promise is memoized (not the result) so
// concurrent first-callers share one query.
let rubStartByPage: Promise<Map<number, number>> | null = null;
const getRubStartByPage = (): Promise<Map<number, number>> => {
  rubStartByPage ??= QuranContentDB.getRubStartPages()
    .then((rows) => new Map(rows.map((r) => [r.page, r.division])))
    .catch((error) => {
      log.e("Page", "Failed to load rub start pages", error as Error);
      rubStartByPage = null; // allow a retry on next call
      return new Map<number, number>();
    });
  return rubStartByPage;
};

export type PageData = {
  pageAvailable: boolean;
  isPageMode: boolean;
  surahNames: Record<number, string>;
  // Lines that are a surah header, mapped to their surah number. The header has
  // no glyph bounds, so this is how a touch on that line resolves to a surah.
  surahHeaderLines: Record<number, number>;
  juz: number;
  // The rub (hizb quarter) that starts on this page, or null — drives the
  // footer's quarter-holder variant.
  rubStart: number | null;
  glyphBounds: GlyphBound[];
  sourcePageHeight: number;
  pageDataLoaded: boolean;
};

// Everything the reader needs for one page, sourced from the content DB and the
// filesystem: whether the page's images are on disk, the rendering mode (line
// vs full-page), line-derived surah names, juz, glyph bounds, and the source
// image height used for page-mode highlight geometry.
export const usePageData = (version: MushafVersion, page: number): PageData => {
  // A page's images land on disk the moment its bundle finishes extracting —
  // i.e. when the version's download status becomes COMPLETE — so presence is
  // re-checked whenever that status changes.
  const downloadStatus = useQuranStore((s) => s.versionDownloads[version]?.status);

  const [pageAvailable, setPageAvailable] = useState(() =>
    QuranDownload.isPageAvailable(version, page)
  );
  const [surahNames, setSurahNames] = useState<Record<number, string>>({});
  const [surahHeaderLines, setSurahHeaderLines] = useState<Record<number, number>>({});
  const [juz, setJuz] = useState(1);
  const [rubStart, setRubStart] = useState<number | null>(null);
  const [glyphBounds, setGlyphBounds] = useState<GlyphBound[]>([]);
  const [sourcePageHeight, setSourcePageHeight] = useState(0);
  // True once the page's glyph/metadata load attempt has finished (success or
  // failure). Lets the page render its image and ayah markers together rather
  // than showing the image first and popping the markers in when glyphs resolve.
  const [pageDataLoaded, setPageDataLoaded] = useState(false);

  // A page-mode version reports LINE until its bundle has extracted and the
  // pages directory exists, so recompute the mode when availability flips.
  const isPageMode = useMemo(
    () => QuranDownload.getImageType(version) === MushafImageType.PAGE,
    // pageAvailable is a deliberate trigger to recompute the mode once images land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, pageAvailable]
  );

  useEffect(() => {
    const available = QuranDownload.isPageAvailable(version, page);
    // Deferred to the react-compiler migration (set-state-in-effect backlog).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageAvailable(available);
    if (!available) QuranDownload.prioritizePage(page);
  }, [page, version, downloadStatus]);

  // Source image height drives page-mode highlight math.
  useEffect(() => {
    if (!pageAvailable || !isPageMode) return;
    const pageStr = String(page).padStart(3, "0");
    const imgUri = `${Paths.document.uri}quran/${version}/pages/${pageStr}.png`;
    Image.getSize(imgUri, (_w, h) => setSourcePageHeight(h));
  }, [page, version, pageAvailable, isPageMode]);

  useEffect(() => {
    if (!pageAvailable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageDataLoaded(false);

    const loadPageData = async () => {
      try {
        const [lineMetadata, bounds] = await Promise.all([
          QuranContentDB.getLineMetadata(version, page),
          QuranContentDB.getGlyphBounds(version, page),
        ]);

        const names: Record<number, string> = {};
        const headers: Record<number, number> = {};
        for (const lm of lineMetadata) {
          if (lm.surahNumber && lm.surahName) {
            names[lm.surahNumber] = lm.surahName;
          }
          if (lm.type === LineType.SURAH_HEADER && lm.surahNumber) {
            headers[lm.line] = lm.surahNumber;
          }
        }
        setSurahNames(names);
        setSurahHeaderLines(headers);
        setJuz(juzForPage(page));
        setRubStart((await getRubStartByPage()).get(page) ?? null);
        setGlyphBounds(bounds);
      } catch (error) {
        log.e("Page", `Failed to load data for page ${page}`, error as Error);
      } finally {
        setPageDataLoaded(true);
      }
    };

    loadPageData();
  }, [page, version, pageAvailable]);

  return {
    pageAvailable,
    isPageMode,
    surahNames,
    surahHeaderLines,
    juz,
    rubStart,
    glyphBounds,
    sourcePageHeight,
    pageDataLoaded,
  };
};
