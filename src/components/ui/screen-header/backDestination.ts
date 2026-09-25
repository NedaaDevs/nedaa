/** The parts of a React Navigation state this module reads. A nested state may be partial. */
type NamedRoute = { key?: string; name: string; state?: NestedState };
type NestedState = { key?: string; index?: number; routes: readonly NamedRoute[] };

export type NavigatorRoute = NamedRoute & { key: string };

export type NavigatorState = {
  key: string;
  type?: string;
  index?: number;
  routes: readonly NavigatorRoute[];
  history?: readonly unknown[];
};

/** Expo Router's name for the root layout, which the file paths leave out. */
const ROOT_LAYOUT_ROUTE = "__root";

const focusedIndex = (state: { index?: number; routes: readonly unknown[] }) =>
  state.index ?? state.routes.length - 1;

/** A mounted navigator keys its state and routes; a link's partial does not. */
const isMounted = (state: NestedState): state is NavigatorState =>
  typeof state.key === "string" && state.routes.every((route) => route.key !== undefined);

/** Navigator states from the one holding route `key` out to `state`. */
const chainTo = (state: NestedState, key: string): NavigatorState[] | undefined => {
  if (!isMounted(state)) return undefined;
  for (const route of state.routes) {
    if (route.key === key) return [state];
    const inner = route.state && chainTo(route.state, key);
    if (inner) return [...inner, state];
  }
  return undefined;
};

/** Mounted navigator states along the focused path, innermost first. */
const focusedChain = (state: NestedState): NavigatorState[] => {
  if (!isMounted(state)) return [];
  const focused = state.routes[focusedIndex(state)];
  return [...(focused?.state ? focusedChain(focused.state) : []), state];
};

/** Tab history also records non-route entries, which back skips. */
const isRouteVisit = (entry: unknown): entry is { type: "route"; key: string } =>
  typeof entry === "object" &&
  entry !== null &&
  "type" in entry &&
  entry.type === "route" &&
  "key" in entry &&
  typeof entry.key === "string";

/** A stack goes back to the entry below; tabs go back through their visit history. */
const routeBehind = (state: NavigatorState, key: string): NavigatorRoute | undefined => {
  if (state.type === "tab") {
    const visits = (state.history ?? []).filter(isRouteVisit);
    const at = visits.findLastIndex((visit) => visit.key === key);
    const previous = at > 0 ? visits[at - 1].key : undefined;
    return state.routes.find((route) => route.key === previous);
  }
  const at = state.routes.findIndex((route) => route.key === key);
  return at > 0 ? state.routes[at - 1] : undefined;
};

/** A freshly mounted navigator is not yet on its holder, which is then the focused route. */
const holderOf = (parent: NavigatorState, child: NavigatorState): NavigatorRoute =>
  parent.routes.find((route) => route.state?.key === child.key) ??
  parent.routes[focusedIndex(parent)];

/** Names from a route down to the screen it is showing. */
const focusedNames = (route: NamedRoute): string[] => {
  const nested = route.state;
  if (!nested?.routes.length) return [route.name];
  return [route.name, ...focusedNames(nested.routes[focusedIndex(nested)])];
};

/** A just-mounted navigator is not in the tree yet; its holder is focused. */
export const chainFor = (root: NestedState, own: NavigatorState, key: string): NavigatorState[] =>
  chainTo(root, key) ?? [own, ...focusedChain(root)];

/**
 * The screen `router.back()` lands on, as its file path under src/app. `chain` runs
 * from the screen's own navigator out to the root; a navigator with nothing behind
 * hands the back action to its parent, as React Navigation does.
 */
export const backDestination = (
  chain: readonly NavigatorState[],
  ownKey: string
): string | undefined => {
  let key = ownKey;
  for (const [level, state] of chain.entries()) {
    const behind = routeBehind(state, key);
    if (behind) {
      const holders = chain
        .slice(level + 1)
        .map((parent, i) => holderOf(parent, chain[level + i]).name)
        .reverse();
      return [...holders, ...focusedNames(behind)]
        .filter((name) => name !== ROOT_LAYOUT_ROUTE)
        .join("/");
    }
    const parent = chain[level + 1];
    if (!parent) return undefined;
    key = holderOf(parent, state).key;
  }
  return undefined;
};
