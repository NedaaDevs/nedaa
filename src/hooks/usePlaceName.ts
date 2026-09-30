import { useTranslation } from "react-i18next";

import { useLocationStore } from "@/stores/location";

/** The user's city and country, or whichever of the two is known. */
export const usePlaceName = (): string | undefined => {
  const { t } = useTranslation();
  const { city, country } = useLocationStore((state) => state.localizedLocation);
  return city && country ? t("tools.place", { city, country }) : city || country || undefined;
};
