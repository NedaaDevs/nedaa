import { useEffect } from "react";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Constants
import { DEFAULT_ATHKAR_DATA } from "@/constants/AthkarData";
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Types
import type { Athkar } from "@/types/athkar";

export const useInitializeAthkar = () => {
  const { shortVersion, morningAthkarList, eveningAthkarList, updateAthkarLists } =
    useAthkarStore();

  useEffect(() => {
    const { morningList, eveningList } = DEFAULT_ATHKAR_DATA.reduce(
      (acc, athkar) => {
        // Skip the version of id "26" that doesn't match shortVersion preference
        if (athkar.id === "26") {
          const isShortVersion = athkar.count === 10;
          if (isShortVersion !== shortVersion) {
            return acc; // Skip this item
          }
        }

        const createAthkarItem = (suffix: string): Athkar => ({
          ...athkar,
          id: `${athkar.order}-${suffix}`, // 1-morning,1-evening
        });

        switch (athkar.type) {
          case ATHKAR_TYPE.MORNING:
            acc.morningList.push(createAthkarItem("morning"));
            break;
          case ATHKAR_TYPE.EVENING:
            acc.eveningList.push(createAthkarItem("evening"));
            break;
          case ATHKAR_TYPE.ALL:
            acc.morningList.push(createAthkarItem("morning"));
            acc.eveningList.push(createAthkarItem("evening"));
            break;
        }

        return acc;
      },
      { morningList: [] as Athkar[], eveningList: [] as Athkar[] }
    );

    // Once short version enabled/disabled we update the count value in the db
    updateAthkarLists(morningList, eveningList);
  }, [shortVersion, updateAthkarLists]);

  return {
    isInitialized: morningAthkarList.length > 0 && eveningAthkarList.length > 0,
  };
};
