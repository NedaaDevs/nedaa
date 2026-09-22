// Components
import { Background } from "@/components/ui/background";
import ConcatUs from "@/components/ContactUs";
import { ScreenHeader } from "@/components/ui/screen-header";

const HelpSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.help.title" href="/settings" backOnClick />
      <ConcatUs />
    </Background>
  );
};

export default HelpSettings;
