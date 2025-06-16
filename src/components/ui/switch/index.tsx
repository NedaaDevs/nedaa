"use client";
import React from "react";
import { Switch as RNSwitch } from "react-native";
import { createSwitch } from "@gluestack-ui/switch";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { withStyleContext } from "@gluestack-ui/nativewind-utils/withStyleContext";
import type { VariantProps } from "@gluestack-ui/nativewind-utils";
import { useColorScheme } from "nativewind";

const UISwitch = createSwitch({
  Root: withStyleContext(RNSwitch),
});

const switchStyle = tva({
  base: "data-[focus=true]:outline-0 data-[focus=true]:ring-2 data-[focus=true]:ring-indicator-primary web:cursor-pointer disabled:cursor-not-allowed data-[disabled=true]:opacity-40 data-[invalid=true]:border-error-700 data-[invalid=true]:rounded-xl data-[invalid=true]:border-2",

  variants: {
    size: {
      sm: "scale-75",
      md: "",
      lg: "scale-125",
    },
  },
});

type ISwitchProps = React.ComponentProps<typeof UISwitch> & VariantProps<typeof switchStyle>;
const Switch = React.forwardRef<React.ComponentRef<typeof UISwitch>, ISwitchProps>(
  ({ className, size = "md", ...props }, ref) => {
    const { colorScheme } = useColorScheme();

    // Define theme-aware colors
    const themeColors = {
      light: {
        trackColorTrue: "rgb(28, 93, 133)", // Primary color
        trackColorFalse: "rgb(226, 232, 240)", // Outline color
        thumbColorTrue: "rgb(255, 255, 255)", // White thumb when on
        thumbColorFalse: "rgb(255, 255, 255)", // White thumb when off
        ios_backgroundColor: "rgb(226, 232, 240)", // iOS track background
      },
      dark: {
        trackColorTrue: "rgb(230, 196, 105)", // Golden primary
        trackColorFalse: "rgb(75, 85, 99)", // Dark outline
        thumbColorTrue: "rgb(34, 40, 49)", // Dark thumb when on
        thumbColorFalse: "rgb(255, 255, 255)", // White thumb when off
        ios_backgroundColor: "rgb(75, 85, 99)", // iOS dark track background
      },
    };

    const colors = themeColors[colorScheme || "light"];

    return (
      <UISwitch
        ref={ref}
        {...props}
        trackColor={{
          false: colors.trackColorFalse,
          true: colors.trackColorTrue,
        }}
        thumbColor={props.value ? colors.thumbColorTrue : colors.thumbColorFalse}
        ios_backgroundColor={colors.ios_backgroundColor}
        className={switchStyle({ size, class: className })}
      />
    );
  }
);

Switch.displayName = "Switch";
export { Switch };
