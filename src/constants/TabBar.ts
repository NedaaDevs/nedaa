import { AlarmClock, BookOpen, Ellipsis, House, type LucideIcon } from "lucide-react-native";

import { OpeningTab, type OpeningTabValue } from "@/enums/app";

/** Each bar tab's entry by route name, in the bar's order. */
const TAB_ITEM = {
  [OpeningTab.HOME]: { name: OpeningTab.HOME, title: "a11y.tab.home", icon: House },
  [OpeningTab.QURAN]: { name: OpeningTab.QURAN, title: "a11y.tab.quran", icon: BookOpen },
  [OpeningTab.ATHKAR]: { name: OpeningTab.ATHKAR, title: "a11y.tab.athkar", icon: AlarmClock },
  [OpeningTab.TOOLS]: { name: OpeningTab.TOOLS, title: "a11y.tab.tools", icon: Ellipsis },
} as const satisfies {
  [Name in OpeningTabValue]: { name: Name; title: string; icon: LucideIcon };
};

export type TabItem = (typeof TAB_ITEM)[OpeningTabValue];

/** The bar's tabs in the order it shows them. */
export const TAB_ITEMS: readonly TabItem[] = Object.values(TAB_ITEM);

/** A tab's entry by its route name. */
export const tabItem = (name: OpeningTabValue): TabItem => TAB_ITEM[name];
