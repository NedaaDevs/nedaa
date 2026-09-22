import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import AudioSettings from "@/components/athkar/AudioSettings";

const AthkarAudioSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.athkarAudio.title" backOnClick />
      <AudioSettings />
    </Background>
  );
};

export default AthkarAudioSettings;
