import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

type HostNode = { type: string; props: Record<string, unknown>; children: HostNode[] | null };

/** The platform floor for a touch target, in points. */
const MIN_TARGET = 44;

const hidden = ({ props }: HostNode) =>
  props.accessibilityElementsHidden === true ||
  props.importantForAccessibility === "no-hide-descendants";

const controlsIn = (node: HostNode | HostNode[] | string | null, out: HostNode[] = []) => {
  if (!node || typeof node === "string") return out;
  if (Array.isArray(node)) {
    for (const child of node) controlsIn(child, out);
    return out;
  }
  if (hidden(node)) return out;
  if (node.props.onResponderRelease || node.props.onClick) out.push(node);
  for (const child of node.children ?? []) controlsIn(child, out);
  return out;
};

type Slop = { top?: number; bottom?: number } | number | undefined;

/** The drawn height plus any invisible touch area above and below it. */
const touchHeightOf = (style: unknown, hitSlop: Slop) => {
  const { minHeight, height } = StyleSheet.flatten(style as never) ?? {};
  const drawn = Math.max(Number(minHeight) || 0, Number(height) || 0);
  const slop =
    typeof hitSlop === "number" ? 2 * hitSlop : (hitSlop?.top ?? 0) + (hitSlop?.bottom ?? 0);
  return drawn + slop;
};

/** Every control on screen that lacks a role, a name, or a 44pt target. */
export const controlProblems = (): string[] =>
  controlsIn(screen.toJSON() as never).flatMap(({ props }) => {
    const name = String(props.accessibilityLabel ?? "");
    const problems: string[] = [];
    if (!props.role && !props.accessibilityRole) problems.push("no role");
    if (!name.trim()) problems.push("no label");
    if (touchHeightOf(props.style, props.hitSlop as Slop) < MIN_TARGET)
      problems.push(`under ${MIN_TARGET}pt`);
    return problems.length ? [`${name || "(unnamed)"}: ${problems.join(", ")}`] : [];
  });
