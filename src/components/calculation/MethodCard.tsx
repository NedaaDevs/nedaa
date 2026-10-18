import type { Ref } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { CALCULATION_PICKER, CALCULATION_TITLE_KEY } from "@/constants/Calculation";
import { useRTL } from "@/contexts/RTLContext";

type Props = {
  /** The method in effect, or the provider's choice when none is set. */
  name: string;
  /** True while the provider picks the method for the place. */
  auto: boolean;
  onPress: () => void;
  disabled?: boolean;
  ref?: Ref<ViewInstance>;
};

/** The method in effect, leading to the list of methods. */
export const MethodCard = ({ name, auto, onPress, disabled, ref }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const title = t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD]);
  const note = auto ? t("settings.calculation.method.autoNote") : undefined;
  const label = t("a11y.join", { first: title, second: name });

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={note ? t("a11y.join", { first: label, second: note }) : label}
      accessibilityHint={t("a11y.opens", { name: title })}
      gap="$1"
      padding="$3.5"
      borderWidth={1}
      borderColor="$accent"
      borderRadius="$card"
      backgroundColor="$accentSoft">
      <Text size="xs" color="$muted">
        {title}
      </Text>
      <HStack alignItems="center" justifyContent="space-between" gap="$3">
        <Text size="md" bold typography="title" color="$fg" flex={1}>
          {name}
        </Text>
        <Icon as={isRTL ? ChevronLeft : ChevronRight} size="md" color="$accent" />
      </HStack>
      {note ? (
        <Text size="xs" color="$muted">
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
};
