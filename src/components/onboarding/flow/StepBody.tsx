import type { ReactNode } from "react";

import { SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";

const GROW = { flexGrow: 1 };

/** A step's scrolling column; a step holding a list draws its own. */
export const StepBody = ({ children }: { children: ReactNode }) => (
  <SkyScrollView contentContainerStyle={GROW} showsVerticalScrollIndicator={false}>
    <VStack padding="$4" gap="$5">
      {children}
    </VStack>
  </SkyScrollView>
);
