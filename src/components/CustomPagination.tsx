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
    <Box
      flexDirection="row"
      justifyContent="center"
      alignItems="center"
      gap="$2"
      paddingVertical="$3">
      {data.map((_, index) => (
        <Pressable
          key={index}
          onPress={() => onPress(index)}
          hitSlop={12}
          accessibilityRole="button">
          <Box
            width={currentIndex === index ? 24 : 8}
            height={6}
            backgroundColor={currentIndex === index ? "$accentPrimary" : "$outline"}
            borderRadius={999}
          />
        </Pressable>
      ))}
    </Box>
  );
};

export default CustomPagination;
