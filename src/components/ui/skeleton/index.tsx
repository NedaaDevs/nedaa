import React, { useRef, useEffect } from "react";
import { Animated, Easing, type ViewProps } from "react-native";
import { styled, YStack, useTheme } from "tamagui";

type SkeletonVariant = "sharp" | "circular" | "rounded";

const VARIANT_RADIUS: Record<SkeletonVariant, number> = {
  sharp: 0,
  circular: 999,
  rounded: 6,
};

// --- Skeleton ---
// Uses RN Animated for the looping pulse (Tamagui animations don't support loop).

type SkeletonProps = ViewProps & {
  variant?: SkeletonVariant;
  isLoaded?: boolean;
  startColor?: string;
  children?: React.ReactNode;
};

const Skeleton = React.forwardRef<React.ComponentRef<typeof Animated.View>, SkeletonProps>(
  ({ variant = "rounded", isLoaded = false, startColor, children, style, ...props }, ref) => {
    const theme = useTheme();
    const resolvedColor = startColor ?? theme.backgroundMuted.val;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (isLoaded) return;

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();
      return () => animation.stop();
    }, [isLoaded, pulseAnim]);

    if (isLoaded) {
      return <>{children}</>;
    }

    return (
      <Animated.View
        ref={ref}
        style={[
          {
            backgroundColor: resolvedColor,
            borderRadius: VARIANT_RADIUS[variant],
            width: "100%",
            height: "100%",
            opacity: pulseAnim,
          },
          style,
        ]}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

// --- SkeletonText ---
// Uses Tamagui YStack for layout, individual Skeleton for each line.

const SkeletonTextContainer = styled(YStack, {
  name: "SkeletonTextContainer",
});

type SkeletonTextProps = ViewProps & {
  _lines?: number;
  isLoaded?: boolean;
  startColor?: string;
  gap?: number;
  children?: React.ReactNode;
};

const SkeletonText = React.forwardRef<React.ComponentRef<typeof Animated.View>, SkeletonTextProps>(
  ({ _lines, isLoaded = false, startColor, gap = 8, children, style, ...props }, ref) => {
    const theme = useTheme();
    const resolvedColor = startColor ?? theme.backgroundMuted.val;
    if (isLoaded) {
      return <>{children}</>;
    }

    if (_lines && _lines > 1) {
      return (
        <SkeletonTextContainer gap={gap} ref={ref as any}>
          {Array.from({ length: _lines }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              startColor={resolvedColor}
              style={[{ width: "100%", borderRadius: 4 }, style]}
              {...props}
            />
          ))}
        </SkeletonTextContainer>
      );
    }

    return (
      <Skeleton
        ref={ref}
        variant="rounded"
        startColor={resolvedColor}
        style={[{ width: "100%", borderRadius: 4 }, style]}
        {...props}
      />
    );
  }
);

SkeletonText.displayName = "SkeletonText";

export { Skeleton, SkeletonText };
export type { SkeletonProps, SkeletonTextProps };
