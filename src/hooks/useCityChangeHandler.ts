import { useCallback } from "react";

import { useLocationStore } from "@/stores/location";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";

export const useCityChangeHandler = () => {
  const locationStore = useLocationStore();
  const { updateState, executeUpdate, retry } = useLocationUpdate();

  const handleCityChangeUpdate = useCallback(async () => {
    try {
      await executeUpdate();
      locationStore.dismissCityChangeModal();
    } catch {
      // Don't dismiss — let the user see the error/retry UI in the modal
    }
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
    retryUpdate: retry,
  };
};

export default useCityChangeHandler;
