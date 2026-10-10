import { useIsFocused, useRootNavigationState, useRoute } from "expo-router";
import { useNavigationState } from "expo-router/react-navigation";

import { backDestination, chainFor } from "@/components/ui/screen-header/backDestination";

/** Where back goes from this screen, read from the root navigation tree. */
export const useBackDestination = (): string | undefined => {
  // Re-renders on focus, so a screen back in view reads the tree again.
  useIsFocused();
  const root = useRootNavigationState();
  const own = useNavigationState((state) => state);
  const { key } = useRoute();
  return backDestination(chainFor(root, own, key), key);
};
