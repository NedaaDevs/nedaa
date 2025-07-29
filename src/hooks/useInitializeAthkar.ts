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
      if (athkar.id === "26") return shortVersion;
      if (athkar.id === "28") return !shortVersion;

      return true;
    });

    setAthkarList(filteredAthkar);
  }, [shortVersion]);

  return {
    isInitialized: athkarList.length > 0,
  };
};
