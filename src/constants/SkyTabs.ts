import { OpeningTab, type OpeningTabValue } from "@/enums/app";

/** Tabs drawn on the sky: it runs under the status and tab bars. */
export const SKY_TABS: readonly OpeningTabValue[] = [OpeningTab.HOME, OpeningTab.TOOLS];

/** Whether a tab route, by name, is drawn on the sky. */
export const isSkyTab = (name: string) => SKY_TABS.some((tab) => tab === name);
