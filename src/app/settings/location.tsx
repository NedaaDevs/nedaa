import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import Location from "@/components/Location";

const LocationSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader
        title={t("settings.location.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />
      <Location />
    </Background>
  );
};

export default LocationSettings;
