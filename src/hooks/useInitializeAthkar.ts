import { useEffect } from "react";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Constants
import { DEFAULT_ATHKAR_DATA } from "@/constants/AthkarData";

export const useInitializeAthkar = () => {
  const { athkarList, setAthkarList, shortVersion } = useAthkarStore();

  useEffect(() => {
    const filteredAthkar = DEFAULT_ATHKAR_DATA.filter((athkar) => {
      // Show short version (26) when shortVersion is true, long version (28) when false
      if (athkar.id === "26" && shortVersion) {
        return athkar.count === 10;
      } else if (athkar.id === "26" && !shortVersion) {
        return athkar.count === 100;
      }

      return true;
    });

    setAthkarList(filteredAthkar);
  }, [shortVersion]);

  return {
    isInitialized: athkarList.length > 0,
  };
};
