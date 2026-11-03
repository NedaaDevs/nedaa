import { useLayoutEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { getTokenValue, type TamaguiElement } from "tamagui";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { pairFits } from "@/components/ui/button-pair/fit";

export type PairAction = {
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Test ids for the row and the hidden label copies. */
export const BUTTON_PAIR_PART = {
  ROW: "button-pair-row",
  MEASURE: "button-pair-measure",
} as const;

/** A medium button's side padding and the gap between the two buttons. */
const insetToken = () => getTokenValue("$5", "space");
const gapToken = () => getTokenValue("$2", "space");

const widthOf = (node: TamaguiElement | null): number =>
  node?.getBoundingClientRect?.()?.width ?? 0;
const widthFrom = ({ nativeEvent }: LayoutChangeEvent): number => nativeEvent.layout.width;

type Widths = { row: number; labels: readonly [number, number] };
const UNMEASURED: Widths = { row: 0, labels: [0, 0] };

/**
 * The row's width and both labels' natural widths. The layout effect reads
 * them before the first paint; `onLayout` follows later size changes.
 */
const useWidths = (labels: readonly [string, string]) => {
  const rowRef = useRef<TamaguiElement>(null);
  const copyRefs = useRef<[TamaguiElement | null, TamaguiElement | null]>([null, null]);
  const [widths, setWidths] = useState<Widths>(UNMEASURED);
  const [first, second] = labels;

  useLayoutEffect(() => {
    const [a, b] = copyRefs.current;
    const read = { row: widthOf(rowRef.current), labels: [widthOf(a), widthOf(b)] } as const;
    // A host with no synchronous read leaves the state to `onLayout`.
    if (read.row > 0) setWidths(read);
  }, [first, second]);

  const setLabel = (index: 0 | 1) => (event: LayoutChangeEvent) =>
    setWidths((now) => {
      const next: [number, number] = [...now.labels];
      next[index] = widthFrom(event);
      return { ...now, labels: next };
    });

  return {
    widths,
    rowRef,
    copyRefs,
    onRowLayout: (event: LayoutChangeEvent) =>
      setWidths((now) => ({ ...now, row: widthFrom(event) })),
    onFirstLayout: setLabel(0),
    onSecondLayout: setLabel(1),
  };
};

type ActionButtonProps = { action: PairAction; lead?: boolean; flex?: number };

/** One action as a full button; the lead action is filled. */
export const ActionButton = ({ action, lead = false, flex }: ActionButtonProps) => (
  <Button
    action={lead ? "primary" : "secondary"}
    variant={lead ? "solid" : "outline"}
    size="md"
    borderRadius="$control"
    testID={action.testID}
    accessibilityLabel={action.label}
    accessibilityHint={action.hint}
    disabled={action.disabled}
    onPress={action.onPress}
    flex={flex}>
    <Button.Text>{action.label}</Button.Text>
  </Button>
);

type Props = { primary: PairAction; secondary: PairAction };

/**
 * A main action and its alternative. Side by side, main first, when both
 * labels fit in half the row; stacked, main on top, until they are measured
 * or when a longer label needs the width.
 */
export const ButtonPair = ({ primary, secondary }: Props) => {
  const { widths, rowRef, copyRefs, onRowLayout, onFirstLayout, onSecondLayout } = useWidths([
    primary.label,
    secondary.label,
  ]);
  const measured = widths.row > 0 && widths.labels.every((width) => width > 0);
  const sideBySide =
    measured &&
    pairFits({ rowWidth: widths.row, gap: gapToken(), inset: insetToken(), labels: widths.labels });
  const flexDirection = sideBySide ? "row" : "column";
  const grow = sideBySide ? { flex: 1 } : null;

  return (
    <Box
      ref={rowRef}
      testID={BUTTON_PAIR_PART.ROW}
      flexDirection={flexDirection}
      gap="$2"
      onLayout={onRowLayout}>
      <ActionButton action={primary} lead {...grow} />
      <ActionButton action={secondary} {...grow} />
      {[
        { action: primary, onLayout: onFirstLayout, slot: 0 },
        { action: secondary, onLayout: onSecondLayout, slot: 1 },
      ].map(({ action, onLayout, slot }) => (
        <Box
          key={slot}
          ref={(node: TamaguiElement | null) => {
            copyRefs.current[slot] = node;
          }}
          testID={BUTTON_PAIR_PART.MEASURE}
          position="absolute"
          opacity={0}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={onLayout}>
          <Button.Text numberOfLines={1}>{action.label}</Button.Text>
        </Box>
      ))}
    </Box>
  );
};
