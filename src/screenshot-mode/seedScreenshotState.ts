import { useLocationStore } from "@/stores/location";

export function seedScreenshotState() {
  useLocationStore.setState({
    locationDetails: {
      coords: {
        latitude: 24.4673,
        longitude: 39.6112,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      address: {
        city: "Madinah",
        country: "Saudi Arabia",
      },
      timezone: "Asia/Riyadh",
      error: null,
      isLoading: false,
    },
    localizedLocation: {
      country: "Saudi Arabia",
      city: "Madinah",
    },
    timezone: "Asia/Riyadh",
    isLocationPermissionGranted: true,
    isGettingLocation: false,
    lastKnownCoords: {
      latitude: 24.4673,
      longitude: 39.6112,
    },
    cityChangeDetected: false,
  });
}
