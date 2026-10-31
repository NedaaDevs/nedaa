import { useEffect, useState } from "react";

import { useAppVisibility } from "@/hooks/useAppVisibility";
import type { LocationPermission } from "@/types/location";
import { checkLocationPermission, requestLocationPermission } from "@/utils/location";

/** Location access, checked on mount and on each return, as from Settings. */
export const useLocationPermission = () => {
  const { becameActiveAt } = useAppVisibility();
  const [permission, setPermission] = useState<LocationPermission | null>(null);

  useEffect(() => {
    let live = true;
    void checkLocationPermission().then((next) => {
      if (live) setPermission(next);
    });
    return () => {
      live = false;
    };
  }, [becameActiveAt]);

  /** Asks the system when it still can; its answer becomes the new state. */
  const ask = async (): Promise<LocationPermission> => {
    const { granted } = await requestLocationPermission();
    const { canAskAgain } = await checkLocationPermission();
    const next = { granted, canAskAgain };
    setPermission(next);
    return next;
  };

  return { permission, ask };
};
