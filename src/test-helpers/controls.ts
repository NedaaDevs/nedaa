import { screen } from "@testing-library/react-native";
import { StyleSheet, type Insets, type ViewProps } from "react-native";

/** A rendered host element, as RNTL's JSON gives it. */
type HostElement = NonNullable<ReturnType<typeof screen.toJSON>>;

/** The platform floor for a touch target, in points. */
const MIN_TARGET = 44;

const hidden = ({ props }: HostElement) =>
  props.accessibilityElementsHidden === true ||
  props.importantForAccessibility === "no-hide-descendants";

const controlsIn = (node: HostElement | string | null, out: HostElement[] = []) => {
  if (!node || typeof node === "string" || hidden(node)) return out;
  if (node.props.onResponderRelease || node.props.onClick) out.push(node);
  for (const child of node.children) controlsIn(child, out);
  return out;
};

/** The drawn height plus any invisible touch area above and below it. */
const touchHeightOf = (style: ViewProps["style"], hitSlop: Insets | number | undefined) => {
  const { minHeight, height } = StyleSheet.flatten(style) ?? {};
  const drawn = Math.max(Number(minHeight) || 0, Number(height) || 0);
  const slop =
    typeof hitSlop === "number" ? 2 * hitSlop : (hitSlop?.top ?? 0) + (hitSlop?.bottom ?? 0);
  return drawn + slop;
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
