import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { E2E_ID } from "@/constants/E2E";
import { useRTL } from "@/contexts/RTLContext";

/** The link to the city list, under a card's actions. */
export const ChooseCityLink = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const label = t("onboarding.location.chooseCity");
  return (
    <Button
      variant="link"
      testID={E2E_ID.LOCATION_CHOOSE_CITY}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={t("a11y.location.manual.chooseCityHint")}>
      <Button.Text>{label}</Button.Text>
      <Button.Icon as={isRTL ? ChevronLeft : ChevronRight} />
    </Button>
  );
};
