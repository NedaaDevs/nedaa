// Components
import { Background } from "@/components/ui/background";
import Acknowledgements from "@/components/Acknowledgements";
import { ScreenHeader } from "@/components/ui/screen-header";

const AcknowledgementsSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.acknowledgements.title" href="/settings" backOnClick />
      <Acknowledgements />
    </Background>
  );
};

export default AcknowledgementsSettings;
