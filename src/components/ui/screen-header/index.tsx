// Plugins
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Constants
import { findBackDestination, type BackDestination } from "@/constants/BackDestinations";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { useBackDestination } from "@/components/ui/screen-header/useBackDestination";

// Icons
import { ArrowLeft, ArrowRight } from "lucide-react-native";

/**
 * `true` pops the stack. `fallback` pops, or opens that screen when nothing is
 * behind. `to` always opens it, because a tab screen pops to the first tab.
 */
type ScreenHeaderBack = true | { fallback: BackDestination } | { to: BackDestination };

type ScreenHeaderAction = {
  icon: ComponentProps<typeof Icon>["as"];
  label: string;
  onPress: () => void;
};

type Props = {
  /** Display text; the caller translates it. */
  title: string;
  back?: ScreenHeaderBack;
  action?: ScreenHeaderAction;
};

type BackPlan =
  { pop: true; destination?: BackDestination } | { pop: false; destination: BackDestination };

const planBack = (
  back: ScreenHeaderBack | undefined,
  behind: string | undefined
): BackPlan | undefined => {
  if (!back) return undefined;
  if (back !== true && "to" in back) return { pop: false, destination: back.to };
  if (behind) return { pop: true, destination: findBackDestination(behind) };
  if (back !== true) return { pop: false, destination: back.fallback };
  return undefined;
};

export const ScreenHeader = ({ title, back, action }: Props) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const behind = useBackDestination();
  const plan = planBack(back, behind);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const handleBack = () => {
    if (!plan) return;
    if (plan.pop) router.back();
    else router.navigate(plan.destination.href);
  };

  return (
    <Box paddingHorizontal="$5" paddingVertical="$4" backgroundColor="$backgroundElevated">
      <HStack justifyContent="space-between" alignItems="center" width="100%">
        <HStack alignItems="center" gap="$3" flexShrink={1}>
          {plan && (
            <Pressable
              onPress={handleBack}
              padding="$2"
              borderRadius="$4"
              alignItems="center"
              justifyContent="center"
              accessibilityLabel={
                plan.destination
                  ? t("a11y.backTo", { screen: t(plan.destination.title) })
                  : t("a11y.back")
              }>
              <Icon as={BackArrow} size="lg" color="$typographyContrast" />
            </Pressable>
          )}

          <Text size="2xl" bold color="$typographyContrast" accessibilityRole="header">
            {title}
          </Text>
        </HStack>

        {action && (
          <Pressable
            onPress={action.onPress}
            padding="$2"
            borderRadius="$4"
            alignItems="center"
            justifyContent="center"
            accessibilityLabel={action.label}>
            <Icon as={action.icon} size="lg" color="$typographyContrast" />
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};
