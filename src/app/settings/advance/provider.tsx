import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import { Background } from "@/components/ui/background";

import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { ProviderSettings } from "@/components/ProviderSettings";
import { ProviderSaveBar } from "@/components/ProviderSaveBar";

const AdvanceSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader
        title={t("settings.advance.provider.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />
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
