import type { ReactNode } from "react";
import { View } from "react-native";

import type { StepProps } from "@/components/onboarding/flow/types";
import { BrandIcon } from "@/components/ui/brand-icon";
import { SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const CENTRED = { flexGrow: 1, justifyContent: "center" } as const;

type Props = Pick<StepProps, "headingRef" | "onHeadingLayout"> & {
  title: string;
  body: string;
  /** The page's ways on, under the heading. */
  children: ReactNode;
};

/** A welcome page: the app's icon, its heading and line, then its ways on. */
export const WelcomeLayout = ({ headingRef, onHeadingLayout, title, body, children }: Props) => (
  <SkyScrollView contentContainerStyle={CENTRED} showsVerticalScrollIndicator={false}>
    <VStack alignItems="center" paddingHorizontal="$8" paddingVertical="$6" gap="$5">
      <BrandIcon size="$24" />

      <SkyOccluder>
        <VStack alignItems="center" gap="$2">
          <View ref={headingRef} onLayout={onHeadingLayout} accessible accessibilityRole="header">
            <Text size="3xl" bold typography="display" color="$fg" textAlign="center">
              {title}
            </Text>
          </View>
          <Text size="lg" typography="body" color="$mutedSky" textAlign="center">
            {body}
          </Text>
        </VStack>
      </SkyOccluder>

      {children}
    </VStack>
  </SkyScrollView>
);
