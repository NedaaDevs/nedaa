import { TAB_ITEMS, type TabItem } from "@/constants/TabBar";
import { OpeningTab } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { isAthkarSupported } from "@/utils/athkar";

/** The bar's tabs in the app's locale; Athkar needs a locale with athkar. */
export const useBarTabs = (): readonly TabItem[] => {
  const locale = useAppStore((state) => state.locale);
  return TAB_ITEMS.filter((tab) => tab.name !== OpeningTab.ATHKAR || isAthkarSupported(locale));
};
