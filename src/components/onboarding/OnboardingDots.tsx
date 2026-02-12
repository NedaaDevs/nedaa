import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";

type OnboardingDotsProps = {
  total: number;
  current: number;
};

const OnboardingDots = ({ total, current }: OnboardingDotsProps) => (
  <HStack space="sm" className="justify-center py-6">
    {Array.from({ length: total }, (_, i) => (
      <Box
        key={i}
        className={`w-2 h-2 rounded-full ${i === current ? "bg-primary" : "bg-background-muted"}`}
      />
    ))}
  </HStack>
);

export default OnboardingDots;
