import { styled } from "tamagui";
import { Image as RNImage } from "react-native";
import type { GetProps } from "tamagui";

type ImageSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "none";

const Image = styled(RNImage, {
  name: "Image",
  variants: {
    size: {
      "2xs": { width: 24, height: 24 },
      xs: { width: 40, height: 40 },
      sm: { width: 64, height: 64 },
      md: { width: 80, height: 80 },
      lg: { width: 96, height: 96 },
      xl: { width: 128, height: 128 },
      "2xl": { width: 256, height: 256 },
      full: { width: "100%" as any, height: "100%" as any },
      none: {},
    },
  } as const,
  defaultVariants: {
    size: "md",
  },
});

type ImageProps = GetProps<typeof Image>;

export { Image };
export type { ImageProps, ImageSize };
