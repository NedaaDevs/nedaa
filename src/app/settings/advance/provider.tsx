import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import { Background } from "@/components/ui/background";

import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { ProviderSettings } from "@/components/ProviderSettings";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { useApplyCalculation } from "@/hooks/useApplyCalculation";

const AdvanceSettings = () => {
  const { t } = useTranslation();
  const { state, status, apply } = useApplyCalculation();

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
      <StickyActionBar state={state} label={t("common.save")} busyStatus={status} onPress={apply} />
    </Background>
  );
};

export default AdvanceSettings;
