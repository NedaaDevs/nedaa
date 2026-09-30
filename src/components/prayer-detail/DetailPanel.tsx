import type { ReactNode } from "react";

import { VStack } from "@/components/ui/vstack";

export const DETAIL_PANEL_ID = "prayer-detail-panel";

/** A bordered panel inside the sheet; its rows lie flat on it. */
export const DetailPanel = ({ children }: { children: ReactNode }) => (
  <VStack
    testID={DETAIL_PANEL_ID}
    gap="$3"
    padding="$2"
    borderWidth={1}
    borderColor="$border"
    borderRadius="$card"
    backgroundColor="$panel">
    {children}
  </VStack>
);
