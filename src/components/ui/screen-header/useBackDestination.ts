import { useEffect, useState } from "react";
import { useNavigation, useRoute } from "expo-router";

import {
  backDestination,
  type NavigatorState,
} from "@/components/ui/screen-header/backDestination";

type ChainedNavigation = {
  getState: () => NavigatorState | undefined;
  getParent: () => ChainedNavigation | undefined;
};

const chainFrom = (navigation: ChainedNavigation): NavigatorState[] => {
  const chain: NavigatorState[] = [];
  for (let at: ChainedNavigation | undefined = navigation; at; at = at.getParent()) {
    const state = at.getState();
    if (!state) break;
    chain.push(state);
  }
  return chain;
};

/** Where back goes from this screen, read again each time the screen comes into view. */
export const useBackDestination = (): string | undefined => {
  const navigation = useNavigation();
  const { key } = useRoute();
  const [destination, setDestination] = useState(() => backDestination(chainFrom(navigation), key));

  useEffect(
    () =>
      navigation.addListener("focus", () =>
        setDestination(backDestination(chainFrom(navigation), key))
      ),
    [navigation, key]
  );

  return destination;
};
