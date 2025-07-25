import { useEffect } from "react";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Constants
import { DEFAULT_ATHKAR_DATA } from "@/constants/AthkarData";

export const useInitializeAthkar = () => {
  const { athkarList, setAthkarList } = useAthkarStore();

  useEffect(() => {
    // Initialize with default data if empty
    if (athkarList.length === 0) {
      setAthkarList(DEFAULT_ATHKAR_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
