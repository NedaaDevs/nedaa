import { useWindowDimensions } from "react-native";
import { resolveReaderLayout, type ReaderLayout } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";

export const useReaderLayout = (): ReaderLayout => {
  const { width, height } = useWindowDimensions();
  const spreadEnabled = useQuranStore((s) => s.twoPageSpread);
  return resolveReaderLayout({ width, height, spreadEnabled });
};
