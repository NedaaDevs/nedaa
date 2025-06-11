// Components
import { Background } from "@/components/ui/background";
import LanguageList from "@/components/LanguageList";
import TopBar from "@/components/TopBar";

const LanguageSettings = () => {
  return (
    <Background>
      <TopBar title="settings.language" href="/" backOnClick />
      <LanguageList />
    </Background>
  );
};

export default LanguageSettings;
