import { useLocationStore } from "@/stores/location";

const LOCALIZED_MAKKAH: Record<"en" | "ar", { city: string; country: string }> = {
  en: { city: "Makkah", country: "Saudi Arabia" },
  ar: { city: "مكة المكرمة", country: "المملكة العربية السعودية" },
};

export function seedScreenshotState(locale: "en" | "ar" = "en") {
  const place = LOCALIZED_MAKKAH[locale];
  useLocationStore.setState({
    locationDetails: {
      coords: {
        latitude: 21.4225,
        longitude: 39.8262,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      address: {
        city: place.city,
        country: place.country,
      },
      timezone: "Asia/Riyadh",
      error: null,
      isLoading: false,
    },
    localizedLocation: {
      country: place.country,
      city: place.city,
    },
    timezone: "Asia/Riyadh",
    isLocationPermissionGranted: true,
    isGettingLocation: false,
    lastKnownCoords: {
      latitude: 21.4225,
      longitude: 39.8262,
    },
    cityChangeDetected: false,
  });
}
