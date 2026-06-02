import { NetworkStateType, useNetworkState } from "expo-network";

// True when the active connection is cellular (mobile data), used to warn the
// user before a large download.
export const useIsCellular = (): boolean => {
  const state = useNetworkState();
  return state.type === NetworkStateType.CELLULAR;
};
