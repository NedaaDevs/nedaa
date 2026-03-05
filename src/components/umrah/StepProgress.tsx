import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";

type Props = {
  currentStep: number;
  totalSteps: number;
};

const StepProgress = ({ currentStep, totalSteps }: Props) => {
  return (
    <HStack gap="$1" paddingHorizontal="$4" paddingVertical="$2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <Box
          key={i}
          flex={1}
          height={3}
          borderRadius="$1"
          backgroundColor={i <= currentStep ? "$accentPrimary" : "$outline"}
        />
      ))}
    </HStack>
  );
};

export default StepProgress;
