import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { SkyHero } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTodayDates } from "@/hooks/useTodayDates";

type Props = {
  /** The Hijri correction to show, saved or still under a drag. */
  offset: number;
};

/** Today's Hijri date at `offset`, with the Gregorian date under it. */
export const HijriDateHero = ({ offset }: Props) => {
  const { t } = useTranslation();
  const { hijri, gregorian } = useTodayDates(offset);

  return (
    <SkyHero compact accessibilityLabel={t("a11y.sentences", { first: hijri, second: gregorian })}>
      <VStack alignItems="center" gap="$1">
        <Icon as={Calendar} size="xl" color="$accent" />
        <Text size="2xl" bold typography="title" color="$fg" textAlign="center" marginTop="$1">
          {hijri}
        </Text>
        <Text size="sm" typography="helper" color="$mutedSky" textAlign="center">
          {gregorian}
        </Text>
      </VStack>
    </SkyHero>
  );
};
