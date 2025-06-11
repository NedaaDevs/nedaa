// Components
import { Background } from "@/components/ui/background";
import ConcatUs from "@/components/ContactUs";
import TopBar from "@/components/TopBar";

const HelpSettings = () => {
  return (
    <Background>
      <TopBar title="settings.help.title" href="/" backOnClick />
      <ConcatUs />
    </Background>
  );
};

export default HelpSettings;
