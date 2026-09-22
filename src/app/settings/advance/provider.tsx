import { ScrollView } from "react-native";

// Components
import { Background } from "@/components/ui/background";

import { ScreenHeader } from "@/components/ui/screen-header";
import { ProviderSettings } from "@/components/ProviderSettings";
import { ProviderSaveBar } from "@/components/ProviderSaveBar";

const AdvanceSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.advance.provider.title" href="/settings/advance" backOnClick />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled">
        <ProviderSettings />
      </ScrollView>
      {/* Outside the ScrollView: the bar stays reachable wherever the user is editing. */}
      <ProviderSaveBar />
    </Background>
  );
};

export default AdvanceSettings;
