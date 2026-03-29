import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Search } from "lucide-react-native";

type Props = {
  onOpenSearch: () => void;
};

const MyAthkarEmpty: FC<Props> = ({ onOpenSearch }) => {
  const { t } = useTranslation();

  return (
    <VStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$12" gap="$4">
      <Icon as={Search} size="xl" color="$typographySecondary" />
      <VStack alignItems="center" gap="$1">
        <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
          {t("athkar.myAthkar.empty.title")}
        </Text>
        <Text size="md" color="$typographySecondary" textAlign="center">
          {t("athkar.myAthkar.empty.subtitle")}
        </Text>
      </VStack>
      <Button
        size="lg"
        action="primary"
        onPress={onOpenSearch}
        accessibilityRole="button"
        accessibilityLabel={t("athkar.myAthkar.add")}>
        <ButtonIcon as={Search} />
        <Text color="$typographyContrast">{t("athkar.myAthkar.add")}</Text>
      </Button>
    </VStack>
  );
};

export default MyAthkarEmpty;
