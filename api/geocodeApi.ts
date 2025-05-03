import { apiGet } from "@/services/api";

// Constants
import { GEOCODE } from "@/constants/ApiRoutes";

// Types
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";

export const geocodeApi = {
  reverseGeocode: (params: ReverseGeocodeParams) =>
    apiGet<ReverseGeocodeResponse>(GEOCODE.REVERSE, params),
};
