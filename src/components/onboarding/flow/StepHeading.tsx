import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { StepProps } from "@/components/onboarding/flow/types";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type Props = Pick<StepProps, "headingRef" | "progress"> & {
  title: string;
  body?: string;
  /** Centres the lines, for a page drawn around a central mark. */
  centered?: boolean;
};

/** A step's heading, read with the progress; the flow focuses it on arrival. */
export const StepHeading = ({ headingRef, progress, title, body, centered = false }: Props) => {
  const { t } = useTranslation();
  const align = centered ? "center" : undefined;
  return (
    <SkyOccluder>
      <VStack gap="$2">
        <View
          ref={headingRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={
            progress ? t("a11y.join", { first: title, second: progress }) : title
          }>
          <Text size="3xl" bold typography="display" color="$fg" textAlign={align}>
            {title}
          </Text>
        </View>
        {body ? (
          <Text size="md" typography="body" color="$mutedSky" textAlign={align}>
            {body}
          </Text>
        ) : null}
      </VStack>
    </SkyOccluder>
  );
};
