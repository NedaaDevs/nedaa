import { useCallback } from "react";

import { useLocationStore } from "@/stores/location";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";

export const useCityChangeHandler = () => {
  const locationStore = useLocationStore();
  const { updateState, executeUpdate } = useLocationUpdate();

  // A failed update resolves false; the modal stays open on its retry UI.
  const handleCityChangeUpdate = useCallback(async () => {
    if (await executeUpdate()) locationStore.dismissCityChangeModal();
  }, [executeUpdate, locationStore]);

  const checkForCityChange = useCallback(async () => {
    await locationStore.checkAndPromptCityChange();
  }, [locationStore]);

  return {
    showCityChangeModal: locationStore.showCityChangeModal,
    pendingCityChange: locationStore.pendingCityChange,
    updateState,
    handleCityChangeUpdate,
    dismissCityChangeModal: locationStore.dismissCityChangeModal,
    checkForCityChange,
    retryUpdate: handleCityChangeUpdate,
  };
};

export default useCityChangeHandler;
