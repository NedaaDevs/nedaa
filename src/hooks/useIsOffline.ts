import { useNetworkState } from "expo-network";

// True only when connectivity is known-unavailable; an undefined initial probe is not offline.
export const useIsOffline = (): boolean => {
  const state = useNetworkState();
  return state.isConnected === false || state.isInternetReachable === false;
};
