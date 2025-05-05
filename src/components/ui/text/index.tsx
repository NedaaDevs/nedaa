import React from "react";
import type { VariantProps } from "@gluestack-ui/nativewind-utils";
import { Text as RNText } from "react-native";
import { textStyle } from "./styles";

// Hooks
import { useFontFamily, FontWeight } from "@/contexts/FontContext";

type ITextProps = React.ComponentProps<typeof RNText> &
  VariantProps<typeof textStyle> & {
    fontWeight?: string;
    fontFamily?: string;
  };

// Map Tailwind font-weight classes to our FontWeight type
const TAILWIND_FONT_WEIGHT_MAP: Record<string, FontWeight> = {
  "font-normal": "regular",
  "font-medium": "medium",
  "font-semibold": "semibold",
  "font-bold": "bold",
};

const extractFontWeightFromClassName = (className?: string): FontWeight | null => {
  if (!className) return null;

  // Split the className string into individual classes
  const classes = className.split(" ");

  // Find the first class that matches our map
  for (const cls of classes) {
    const trimmedClass = cls.trim();
    if (trimmedClass in TAILWIND_FONT_WEIGHT_MAP) {
      return TAILWIND_FONT_WEIGHT_MAP[trimmedClass];
    }
  }

  return null;
};

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(
  (
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = "md",
      sub,
      italic,
      highlight,
      fontWeight,
      fontFamily: propFontFamily,
      ...props
    },
    ref
  ) => {
    const classNameFontWeight = extractFontWeightFromClassName(className);

    let fontWeightKey: FontWeight = "regular";

    if (classNameFontWeight) {
      // Priority 1: Use font weight from className
      fontWeightKey = classNameFontWeight;
    } else if (bold) {
      // Priority 2: Use bold prop
      fontWeightKey = "bold";
    } else if (fontWeight) {
      // Priority 3: Map string font weights to our FontWeight type
      switch (fontWeight) {
        case "bold":
        case "700":
          fontWeightKey = "bold";
          break;
        case "semibold":
        case "600":
          fontWeightKey = "semibold";
          break;
        case "medium":
        case "500":
          fontWeightKey = "medium";
          break;
        default:
          fontWeightKey = "regular";
      }
    }

    // Get font family based on current locale and determined weight
    const contextFontFamily = useFontFamily(fontWeightKey);

    // Use prop fontFamily if provided, otherwise use the context one
    const finalFontFamily = propFontFamily || contextFontFamily;

    return (
      <RNText
        className={textStyle({
          isTruncated,
          bold,
          underline,
          strikeThrough,
          size,
          sub,
          italic,
          highlight,
          class: className,
        })}
        style={{ fontFamily: finalFontFamily }}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = "Text";

export { Text };
