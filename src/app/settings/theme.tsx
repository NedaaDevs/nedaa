// Components
import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import ThemeList from "@/components/ThemeList";
import TopBar from "@/components/TopBar";
import SettingsToggleRow from "@/components/settings/SettingsToggleRow";

// Stores
import { useAppStore } from "@/stores/app";

const ThemeSettings = () => {
  const { classicColors, setClassicColors } = useAppStore();

  return (
    <Background>
      <TopBar title="settings.appearance" href="/settings" backOnClick />
      <ThemeList />

      {/* A palette, not a mode — it pairs with whichever of Light/Dark/System
          is selected above, so it is a toggle rather than a fourth option. */}
      <Box marginTop="$4" marginHorizontal="$4">
        <SettingsToggleRow
          titleKey="settings.themes.classic.title"
          descriptionKey="settings.themes.classic.description"
          value={classicColors}
          onValueChange={setClassicColors}
        />
      </Box>
    </Background>
  );
};

export default ThemeSettings;
