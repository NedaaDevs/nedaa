import { FC } from "react";

import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";

type PaginationProps = {
  data: any[];
  onPress: (index: number) => void;
  currentIndex: number;
};

const CustomPagination: FC<PaginationProps> = ({ data, onPress, currentIndex }) => {
  return (
    <Box flexDirection="row" justifyContent="center" gap="$2" paddingVertical="$1.5">
      {data.map((_, index) => (
        <Pressable
          key={index}
          onPress={() => onPress(index)}
          hitSlop={12}
          accessibilityRole="button">
          <Box
            width={20}
            height={2}
            backgroundColor={currentIndex === index ? "$accentPrimary" : "$outline"}
            borderRadius={999}
          />
        </Pressable>
      ))}
    </Box>
  );
};

export default CustomPagination;
