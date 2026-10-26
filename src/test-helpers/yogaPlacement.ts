import type { DimensionValue, ViewStyle } from "react-native";
import {
  Align,
  Direction,
  Edge,
  Errata,
  FlexDirection,
  Gutter,
  PositionType,
  loadYoga,
} from "yoga-layout/load";

import { AppDirection } from "@/enums/app";
import { type HostElement, styleOf } from "@/test-helpers/text";

type Yoga = Awaited<ReturnType<typeof loadYoga>>;
type YogaNode = ReturnType<Yoga["Node"]["create"]>;
type YogaConfig = ReturnType<Yoga["Config"]["create"]>;

/** Yoga's spec layout, and the errata React Native lays a screen out with. */
export const YOGA_ERRATA = { SPEC: Errata.None, REACT_NATIVE: Errata.All } as const;
export type YogaErrata = (typeof YOGA_ERRATA)[keyof typeof YOGA_ERRATA];

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
const PADDINGS = [
  ["padding", Edge.All],
  ["paddingHorizontal", Edge.Horizontal],
  ["paddingLeft", Edge.Left],
  ["paddingRight", Edge.Right],
  ["paddingStart", Edge.Start],
  ["paddingEnd", Edge.End],
] as const;
const GAPS = [
  ["gap", Gutter.All],
  ["columnGap", Gutter.Column],
] as const;

const ALIGN: Record<NonNullable<ViewStyle["alignSelf"]>, Align> = {
  auto: Align.Auto,
  "flex-start": Align.FlexStart,
  "flex-end": Align.FlexEnd,
  center: Align.Center,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
};

const FLEX_DIRECTION: Record<NonNullable<ViewStyle["flexDirection"]>, FlexDirection> = {
  row: FlexDirection.Row,
  "row-reverse": FlexDirection.RowReverse,
  column: FlexDirection.Column,
  "column-reverse": FlexDirection.ColumnReverse,
};

const DIRECTION: Record<AppDirection, Direction> = {
  [AppDirection.LTR]: Direction.LTR,
  [AppDirection.RTL]: Direction.RTL,
};

// The host type React Native measures as one leaf.
const HOST_TEXT = "Text";

const isPercent = (value: string): value is `${number}%` => value.endsWith("%");

const length = (value: DimensionValue | string | undefined) =>
  typeof value === "number" || (typeof value === "string" && isPercent(value)) ? value : undefined;

let yoga: Promise<Yoga> | undefined;

/** Only the horizontal layout: heights stay unset. */
const build = (engine: Yoga, config: YogaConfig, { style, children = [] }: YogaBox): YogaNode => {
  const node = engine.Node.create(config);
  if (style.position === "absolute") node.setPositionType(PositionType.Absolute);
  if (style.flexDirection) node.setFlexDirection(FLEX_DIRECTION[style.flexDirection]);
  if (style.alignItems) node.setAlignItems(ALIGN[style.alignItems]);
  if (style.alignSelf) node.setAlignSelf(ALIGN[style.alignSelf]);
  node.setFlex(style.flex);
  node.setFlexGrow(style.flexGrow);
  node.setFlexShrink(style.flexShrink);
  node.setFlexBasis(length(style.flexBasis));
  node.setWidth(length(style.width));
  node.setMinWidth(length(style.minWidth));
  INSETS.forEach(([key, edge]) => node.setPosition(edge, length(style[key])));
  MARGINS.forEach(([key, edge]) => node.setMargin(edge, length(style[key])));
  PADDINGS.forEach(([key, edge]) => node.setPadding(edge, length(style[key])));
  GAPS.forEach(([key, gutter]) => node.setGap(gutter, length(style[key])));
  children.forEach((child, index) => node.insertChild(build(engine, config, child), index));
  return node;
};

/** Each node's span and the span inside its padding, in tree order. */
const boxes = (node: YogaNode, parentLeft = 0): { span: Span; content: Span }[] => {
  const left = parentLeft + node.getComputedLeft();
  const width = node.getComputedWidth();
  const start = node.getComputedPadding(Edge.Left) + node.getComputedBorder(Edge.Left);
  const end = node.getComputedPadding(Edge.Right) + node.getComputedBorder(Edge.Right);
  const children = Array.from({ length: node.getChildCount() }, (_, index) =>
    boxes(node.getChild(index), left)
  );
  return [
    { span: { left, width }, content: { left: left + start, width: width - start - end } },
    ...children.flat(),
  ];
};

const layOut = async (root: YogaBox, direction: AppDirection, errata: YogaErrata) => {
  yoga ??= loadYoga();
  const engine = await yoga;
  const config = engine.Config.create();
  config.setErrata(errata);
  const node = build(engine, config, root);
  node.calculateLayout(undefined, undefined, DIRECTION[direction]);
  const result = boxes(node);
  node.freeRecursive();
  config.free();
  return result;
};

/** Lays the tree out in `direction`; spans list the root, then tree order. */
export const layOutSpans = async (root: YogaBox, direction: AppDirection): Promise<Span[]> =>
  (await layOut(root, direction, YOGA_ERRATA.SPEC)).map(({ span }) => span);

const hostChildren = (element: HostElement): HostElement[] =>
  element.type === HOST_TEXT
    ? []
    : element.children.filter((child): child is HostElement => typeof child !== "string");

const hostBox = (element: HostElement): YogaBox => ({
  style: styleOf(element) ?? {},
  children: hostChildren(element).map(hostBox),
});

const treeOrder = (element: HostElement): HostElement[] => [
  element,
  ...hostChildren(element).flatMap(treeOrder),
];

/** Where each rendered view lands when `element` is laid out `width` wide. */
export const layOutHost = async (
  element: HostElement,
  { width, direction, errata }: { width: number; direction: AppDirection; errata: YogaErrata }
) => {
  const box = hostBox(element);
  const laid = await layOut({ ...box, style: { ...box.style, width } }, direction, errata);
  const order = treeOrder(element);
  const at = (view: HostElement) => {
    const index = order.indexOf(view);
    if (index < 0) throw new Error("the view is outside the laid-out tree");
    return laid[index];
  };
  return {
    /** The view's own span. */
    span: (view: HostElement) => at(view).span,
    /** The span inside the view's padding and border. */
    content: (view: HostElement) => at(view).content,
  };
};
