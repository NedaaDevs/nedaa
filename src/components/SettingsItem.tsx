// Plugins
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { ChevronRight, ChevronLeft } from "lucide-react-native";

// Types
import type { Href } from "expo-router";

type Props = {
  name: string;
  // A route to push, or an in-place action for rows that open a sheet.
  path?: Href;
  onPress?: () => void;
  icon?: any;
  rtl?: boolean;
  currentValue?: string;
};

const SettingsItem = ({ name, path, onPress, icon, currentValue, rtl }: Props) => {
  const { isRTL } = useRTL();
  const { t } = useTranslation();
  const effectiveRTL = rtl !== undefined ? rtl : isRTL;
  const ChevronIcon = effectiveRTL ? ChevronLeft : ChevronRight;

  const a11yLabel = currentValue ? t("a11y.settingsItem", { name, value: currentValue }) : name;

  // Link injects its own onPress by cloning this row, so a link row must not
  // carry the prop at all.
  const row = (
    <Pressable
      {...(path ? {} : { onPress })}
      flexDirection="row"
      alignItems="center"
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t("a11y.settingsItemNav", { name })}>
      <HStack justifyContent="space-between" alignItems="center" zIndex={10} width="100%" gap="$2">
        <HStack alignItems="center" flexShrink={1}>
          {icon && (
            <Box marginEnd="$6">
              <Icon color="$typography" size="lg" as={icon} />
            </Box>
          )}
          <Text size="xl" fontWeight="500" color="$typography" flexShrink={1}>
            {name}
          </Text>
        </HStack>

        <HStack alignItems="center">
          {currentValue && (
            <Text size="lg" color="$typographySecondary" marginEnd="$2">
              {currentValue}
            </Text>
          )}
          <Icon size="xl" color="$typographySecondary" as={ChevronIcon} />
        </HStack>
      </HStack>
    </Pressable>
  );

  return (
    <Card margin="$2" padding="$5">
      {path ? (
        <Link href={path} asChild>
          {row}
        </Link>
      ) : (
        row
      )}
    </Card>
  );
};

export default SettingsItem;
