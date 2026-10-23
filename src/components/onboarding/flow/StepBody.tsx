import type { ReactNode } from "react";

import { ScreenContent } from "@/components/ui/screen-content";
import { SkyScrollView } from "@/components/ui/sky-background";

const GROW = { flexGrow: 1 };

/** A step's scrolling column; a step holding a list draws its own. */
export const StepBody = ({ children }: { children: ReactNode }) => (
  <SkyScrollView contentContainerStyle={GROW} showsVerticalScrollIndicator={false}>
    <ScreenContent paddingVertical="$4" gap="$5">
      {children}
    </ScreenContent>
  </SkyScrollView>
);
