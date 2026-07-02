import { useWindowDimensions } from "react-native";
import { resolveReaderLayout, type ReaderLayout } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";

export const useReaderLayout = (): ReaderLayout => {
  const { width, height } = useWindowDimensions();
  const spreadPreference = useQuranStore((s) => s.spreadPreference);
  return resolveReaderLayout({ width, height, spreadPreference });
};
