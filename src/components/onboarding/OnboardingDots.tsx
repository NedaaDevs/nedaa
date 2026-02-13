import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";

type OnboardingDotsProps = {
  total: number;
  current: number;
};

const OnboardingDots = ({ total, current }: OnboardingDotsProps) => (
  <HStack gap="$2" justifyContent="center" paddingVertical="$6">
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

export default OnboardingDots;
