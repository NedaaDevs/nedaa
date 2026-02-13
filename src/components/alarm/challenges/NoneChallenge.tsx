import { FC } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";

import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  onComplete: () => void;
};

const NoneChallenge: FC<Props> = ({ onComplete }) => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");

  const handleDismiss = () => {
    hapticSuccess();
    onComplete();
  };

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Text size="lg" color="$typographySecondary" textAlign="center">
        {t("alarm.challenge.tapToDismissInstruction")}
      </Text>
      <Button size="xl" action="positive" width="100%" onPress={handleDismiss}>
        <Button.Text>{t("alarm.challenge.dismiss")}</Button.Text>
      </Button>
    </VStack>
  );
};

export default NoneChallenge;
