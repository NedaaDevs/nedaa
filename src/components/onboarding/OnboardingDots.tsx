import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";

type OnboardingDotsProps = {
  total: number;
  current: number;
};

const OnboardingDots = ({ total, current }: OnboardingDotsProps) => {
  const { t } = useTranslation();

  return (
    <HStack
      gap="$2"
      justifyContent="center"
      paddingVertical="$6"
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={t("a11y.stepProgress", { current: current + 1, total })}>
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          width="$2"
          height="$2"
          borderRadius={999}
          backgroundColor={i === current ? "$primary" : "$backgroundMuted"}
        />
      ))}
    </HStack>
  );
};

export default OnboardingDots;
