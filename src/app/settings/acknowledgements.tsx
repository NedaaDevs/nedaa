// Components
import { Background } from "@/components/ui/background";
import Acknowledgements from "@/components/Acknowledgements";
import TopBar from "@/components/TopBar";

const AcknowledgementsSettings = () => {
  return (
    <Background>
      <TopBar title="settings.acknowledgements.title" href="/settings" backOnClick />
      <Acknowledgements />
    </Background>
  );
};

export default AcknowledgementsSettings;
