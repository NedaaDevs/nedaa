import { ScrollView } from "react-native";

// Components
import { Background } from "@/components/ui/background";

import TopBar from "@/components/TopBar";
import { ProviderSettings } from "@/components/ProviderSettings";

const AdvanceSettings = () => {
  return (
    <Background>
      <TopBar title="settings.advance.provider.title" href="/settings/advance" backOnClick />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled">
        <ProviderSettings />
      </ScrollView>
    </Background>
  );
};

export default AdvanceSettings;
