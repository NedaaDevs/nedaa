import { defaultDatabaseDirectory } from "expo-sqlite";

import { CITY_CHECK_STORAGE_DB_NAME } from "@/constants/DB";
import { AppLogger } from "@/utils/appLogger";

import { ExpoDiagnosticsModule } from "../../../modules/expo-diagnostics/src";

const log = AppLogger.create("location");

/** Asks iOS to leave the city-check memory out of backups; a failure leaves it in. */
export const excludeCityCheckFromBackup = async (): Promise<void> => {
  try {
    await ExpoDiagnosticsModule.excludeFromBackup(
      `${defaultDatabaseDirectory}/${CITY_CHECK_STORAGE_DB_NAME}`
    );
  } catch {
    // The error's text may hold the path.
    log.w("CityCheck", "backup exclusion failed");
  }
};
