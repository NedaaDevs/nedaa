import type { DimensionValue, ViewStyle } from "react-native";
import { Align, Direction, Edge, PositionType, loadYoga } from "yoga-layout/load";

import { AppDirection } from "@/enums/app";

type Yoga = Awaited<ReturnType<typeof loadYoga>>;
type YogaNode = ReturnType<Yoga["Node"]["create"]>;

/** A view as Yoga sees it: its style and the views inside it. */
export type YogaBox = { style: ViewStyle; children?: YogaBox[] };

/** A view's horizontal span, in points from the root's physical left. */
export type Span = { left: number; width: number };

// Physical edges stay put; logical ones resolve by the inherited direction.
const INSETS = [
  ["left", Edge.Left],
  ["right", Edge.Right],
  ["start", Edge.Start],
  ["end", Edge.End],
] as const;
const MARGINS = [
  ["marginLeft", Edge.Left],
  ["marginRight", Edge.Right],
  ["marginStart", Edge.Start],
  ["marginEnd", Edge.End],
] as const;

const ALIGN: Record<NonNullable<ViewStyle["alignSelf"]>, Align> = {
  auto: Align.Auto,
  "flex-start": Align.FlexStart,
  "flex-end": Align.FlexEnd,
  center: Align.Center,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
};

const DIRECTION: Record<AppDirection, Direction> = {
  [AppDirection.LTR]: Direction.LTR,
  [AppDirection.RTL]: Direction.RTL,
};

const isPercent = (value: string): value is `${number}%` => value.endsWith("%");

const length = (value: DimensionValue | undefined) =>
  typeof value === "number" || (typeof value === "string" && isPercent(value)) ? value : undefined;

let yoga: Promise<Yoga> | undefined;

/** Only the horizontal placement: Yoga's defaults stretch the rest. */
const build = (engine: Yoga, { style, children = [] }: YogaBox): YogaNode => {
  const node = engine.Node.create();
  if (style.position === "absolute") node.setPositionType(PositionType.Absolute);
  node.setWidth(length(style.width));
  if (style.alignSelf) node.setAlignSelf(ALIGN[style.alignSelf]);
  INSETS.forEach(([key, edge]) => node.setPosition(edge, length(style[key])));
  MARGINS.forEach(([key, edge]) => node.setMargin(edge, length(style[key])));
  children.forEach((child, index) => node.insertChild(build(engine, child), index));
  return node;
};

const spans = (node: YogaNode, parentLeft = 0): Span[] => {
  const left = parentLeft + node.getComputedLeft();
  const children = Array.from({ length: node.getChildCount() }, (_, index) =>
    spans(node.getChild(index), left)
  );
  return [{ left, width: node.getComputedWidth() }, ...children.flat()];
};

/** Lays the tree out in `direction`; spans list the root, then tree order. */
export const layOutSpans = async (root: YogaBox, direction: AppDirection): Promise<Span[]> => {
  yoga ??= loadYoga();
  const node = build(await yoga, root);
  node.calculateLayout(undefined, undefined, DIRECTION[direction]);
  const result = spans(node);
  node.freeRecursive();
  return result;
};
