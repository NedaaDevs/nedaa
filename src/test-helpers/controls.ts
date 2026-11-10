import { screen } from "@testing-library/react-native";
import { StyleSheet, type Insets } from "react-native";

/** A rendered host element, as RNTL's JSON gives it. */
type HostElement = NonNullable<ReturnType<typeof screen.toJSON>>;

/** The platform floor for a touch target, in points. */
export const MIN_TARGET = 44;

const hidden = ({ props }: HostElement) =>
  props.accessibilityElementsHidden === true ||
  props.importantForAccessibility === "no-hide-descendants";

const controlsIn = (node: HostElement | string | null, out: HostElement[] = []) => {
  if (!node || typeof node === "string" || hidden(node)) return out;
  if (node.props.onResponderRelease || node.props.onClick) out.push(node);
  for (const child of node.children) controlsIn(child, out);
  return out;
};

type Style = Parameters<typeof StyleSheet.flatten>[0];

/** The larger of a size and its minimum: the least the layout draws. */
const drawn = (size: unknown, min: unknown) => Math.max(Number(size) || 0, Number(min) || 0);

/** The least width the layout draws for a control's style. */
export const drawnWidthOf = (style: Style) => {
  const { width, minWidth } = StyleSheet.flatten(style) ?? {};
  return drawn(width, minWidth);
};

/** The drawn height plus any invisible touch area above and below it. */
const touchHeightOf = (style: Style, hitSlop: Insets | number | undefined) => {
  const { height, minHeight } = StyleSheet.flatten(style) ?? {};
  const slop =
    typeof hitSlop === "number" ? 2 * hitSlop : (hitSlop?.top ?? 0) + (hitSlop?.bottom ?? 0);
  return drawn(height, minHeight) + slop;
};

/** Every control on screen that lacks a role, a name, or a 44pt target. */
export const controlProblems = (): string[] =>
  controlsIn(screen.toJSON()).flatMap(({ props }) => {
    const name = String(props.accessibilityLabel ?? "");
    const problems: string[] = [];
    if (!props.role && !props.accessibilityRole) problems.push("no role");
    if (!name.trim()) problems.push("no label");
    if (touchHeightOf(props.style, props.hitSlop) < MIN_TARGET)
      problems.push(`under ${MIN_TARGET}pt`);
    return problems.length ? [`${name || "(unnamed)"}: ${problems.join(", ")}`] : [];
  });
