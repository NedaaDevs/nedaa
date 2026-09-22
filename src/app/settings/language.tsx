// Components
import { Background } from "@/components/ui/background";
import LanguageList from "@/components/LanguageList";
import { ScreenHeader } from "@/components/ui/screen-header";

const LanguageSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.language" href="/settings" backOnClick />
      <LanguageList />
    </Background>
  );
};

export default LanguageSettings;
