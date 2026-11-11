import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { TextAction } from "@/components/ui/text-action";
import { E2E_ID } from "@/constants/E2E";
import { useRTL } from "@/contexts/RTLContext";

/** The link to the city list, under a card's actions. */
export const ChooseCityLink = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  return (
    <TextAction
      label={t("onboarding.location.chooseCity")}
      hint={t("a11y.location.manual.chooseCityHint")}
      icon={isRTL ? ChevronLeft : ChevronRight}
      testID={E2E_ID.LOCATION_CHOOSE_CITY}
      onPress={onPress}
    />
  );
};
