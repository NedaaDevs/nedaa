import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";

type Props = {
  titleKey: string;
  descriptionKey?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Sits inline after the title — an info button, a badge. */
  titleAccessory?: ReactNode;
  /** Revealed under the row when the toggle is on, e.g. a duration picker. */
  children?: ReactNode;
};

/**
 * A settings card with a title, optional description, and a trailing switch.
 * The Switch renders natively, so the switch role and checked state come from
 * the platform; only the label is supplied here.
 */
const SettingsToggleRow = ({
  titleKey,
  descriptionKey,
  value,
  onValueChange,
  titleAccessory,
  children,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Card borderRadius="$6">
      <VStack gap="$3">
        <HStack justifyContent="space-between" alignItems="center" width="100%">
          <VStack flexShrink={1} marginEnd="$4">
            <HStack alignItems="center" gap="$1.5" flexWrap="nowrap">
              <Text fontWeight="500" color="$typography" flexShrink={1}>
                {t(titleKey)}
              </Text>
              {titleAccessory}
            </HStack>
            {descriptionKey && (
              <Text size="sm" color="$typographySecondary" marginTop="$1">
                {t(descriptionKey)}
              </Text>
            )}
          </VStack>
          <Switch value={value} onValueChange={onValueChange} accessibilityLabel={t(titleKey)} />
        </HStack>
        {children}
      </VStack>
    </Card>
  );
};

export default SettingsToggleRow;
