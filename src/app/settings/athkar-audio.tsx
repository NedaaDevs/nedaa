import { useTranslation } from "react-i18next";
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import AudioSettings from "@/components/athkar/AudioSettings";

const AthkarAudioSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader title={t("settings.athkarAudio.title")} back />
      <AudioSettings />
    </Background>
  );
};

export default AthkarAudioSettings;
