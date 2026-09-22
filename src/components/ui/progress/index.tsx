import React from "react";
import { styled, View, createStyledContext } from "tamagui";
import type { GetProps } from "tamagui";

type ProgressSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_HEIGHT: Record<ProgressSize, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
};

const ProgressContext = createStyledContext({
  progress: 0,
  size: "md" as ProgressSize,
});

// --- Progress track ---

const ProgressFrame = styled(View, {
  name: "Progress",
  context: ProgressContext,
  backgroundColor: "$backgroundMuted",
  borderRadius: "$pill",
  width: "100%",
  overflow: "hidden",
});

type ProgressFrameProps = GetProps<typeof ProgressFrame> & {
  value?: number;
  size?: ProgressSize;
  min?: number;
  max?: number;
};

const Progress = ProgressFrame.styleable<{
  value?: number;
  size?: ProgressSize;
  min?: number;
  max?: number;
}>((props, ref) => {
  const { value = 0, size = "md", min = 0, max = 100, children, ...rest } = props;
  const clampedValue = Math.max(min, Math.min(max, value));

  return (
    <ProgressContext.Provider progress={clampedValue} size={size}>
      <ProgressFrame
        ref={ref}
        height={SIZE_HEIGHT[size]}
        role="progressbar"
        accessibilityValue={{ min, max, now: clampedValue }}
        {...rest}>
        {children}
      </ProgressFrame>
    </ProgressContext.Provider>
  );
});
Progress.displayName = "Progress";

// --- ProgressFilledTrack (indicator) ---

const ProgressFilledTrackFrame = styled(View, {
  name: "ProgressFilledTrack",
  context: ProgressContext,
  backgroundColor: "$primary",
  borderRadius: "$pill",
});

const ProgressFilledTrack = ProgressFilledTrackFrame.styleable((props, ref) => {
  const ctx = ProgressContext.useStyledContext();
  const height = SIZE_HEIGHT[(ctx.size as ProgressSize) ?? "md"];

  return (
    <ProgressFilledTrackFrame ref={ref} height={height} width={`${ctx.progress}%`} {...props} />
  );
});
ProgressFilledTrack.displayName = "ProgressFilledTrack";

type ProgressProps = ProgressFrameProps;
type ProgressFilledTrackProps = GetProps<typeof ProgressFilledTrackFrame>;

export { Progress, ProgressFilledTrack };
export type { ProgressProps, ProgressFilledTrackProps, ProgressSize };
