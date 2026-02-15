import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import AudioSettings from "@/components/athkar/AudioSettings";

const AthkarAudioSettings = () => {
  return (
    <Background>
      <TopBar title="settings.athkarAudio.title" backOnClick />
      <AudioSettings />
    </Background>
  );
};

export default AthkarAudioSettings;
