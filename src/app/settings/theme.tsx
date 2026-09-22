// Components
import { Background } from "@/components/ui/background";
import ThemeList from "@/components/ThemeList";
import { ScreenHeader } from "@/components/ui/screen-header";

const ThemeSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.appearance" href="/settings" backOnClick />
      <ThemeList />
    </Background>
  );
};

export default ThemeSettings;
