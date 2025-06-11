// Components
import { Background } from "@/components/ui/background";
import ThemeList from "@/components/ThemeList";
import TopBar from "@/components/TopBar";

const ThemeSettings = () => {
  return (
    <Background>
      <TopBar title="settings.appearance" href="/" backOnClick />
      <ThemeList />
    </Background>
  );
};

export default ThemeSettings;
