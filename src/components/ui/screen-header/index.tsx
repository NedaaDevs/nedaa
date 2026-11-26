// Plugins
import { use, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Constants
import { findBackDestination, type BackDestination } from "@/constants/BackDestinations";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { ScreenGutterContext } from "@/components/ui/screen-content";
import { useBackDestination } from "@/components/ui/screen-header/useBackDestination";
import { BackLink } from "@/components/ui/screen-header/back-link";

// Icons
import { ChevronLeft, ChevronRight } from "lucide-react-native";

/**
 * `true` pops the stack. `fallback` pops, or opens that screen when nothing is
 * behind. `to` always opens it, because a tab screen pops to the first tab.
 */
type RoutedBack = true | { fallback: BackDestination } | { to: BackDestination };

/** A back the screen handles itself, to a place named by `name`, already translated. */
type ScreenHeaderOwnBack = { onPress: () => void; name: string };

type ScreenHeaderBack = RoutedBack | ScreenHeaderOwnBack;

const isOwnBack = (back: ScreenHeaderBack): back is ScreenHeaderOwnBack =>
  back !== true && "onPress" in back;

type ScreenHeaderAction = {
  icon: ComponentProps<typeof Icon>["as"];
  label: string;
  onPress: () => void;
};

type SharedProps = {
  /** Display text; the caller translates it. */
  title: string;
  back?: ScreenHeaderBack;
  action?: ScreenHeaderAction;
};

/**
 * `stacked` sets a large title under a back link that names its destination.
 * `bar` centres a small title between the controls and has no room for a subtitle.
 */
type Props =
  | (SharedProps & { variant?: "stacked"; subtitle?: string })
  | (SharedProps & { variant: "bar"; subtitle?: never });

type BackPlan =
  { pop: true; destination?: BackDestination } | { pop: false; destination: BackDestination };

const planBack = (
  back: RoutedBack | undefined,
  behind: string | undefined
): BackPlan | undefined => {
  if (!back) return undefined;
  if (back !== true && "to" in back) return { pop: false, destination: back.to };
  if (behind) return { pop: true, destination: findBackDestination(behind) };
  if (back !== true) return { pop: false, destination: back.fallback };
  return undefined;
};

export const ScreenHeader = ({ title, subtitle, back, action, variant = "stacked" }: Props) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const behind = useBackDestination();
  const gutter = use(ScreenGutterContext);
  const own = back !== undefined && isOwnBack(back) ? back : undefined;
  const plan = back !== undefined && !isOwnBack(back) ? planBack(back, behind) : undefined;
  const hasBack = Boolean(plan ?? own);

  // Back points to the start edge.
  const Chevron = isRTL ? ChevronRight : ChevronLeft;
  const destinationName = own?.name ?? (plan?.destination ? t(plan.destination.title) : undefined);
  const backLabel = destinationName
    ? t("a11y.backTo", { screen: destinationName })
    : t("a11y.back");

  const handleBack = () => {
    if (own) return own.onPress();
    if (!plan) return;
    if (plan.pop) router.back();
    else router.navigate(plan.destination.href);
  };

  const actionButton = action && (
    <Pressable
      onPress={action.onPress}
      accessibilityLabel={action.label}
      alignItems="center"
      justifyContent="center">
      <Icon as={action.icon} size="lg" color="$accent" />
    </Pressable>
  );

  if (variant === "bar") {
    return (
      <HStack alignItems="center" paddingHorizontal="$stack" paddingVertical="$tight">
        <Box width="$target">
          {hasBack && (
            <Pressable
              onPress={handleBack}
              accessibilityLabel={backLabel}
              alignItems="center"
              justifyContent="center">
              <Icon as={Chevron} size="lg" color="$accent" />
            </Pressable>
          )}
        </Box>
        <Text
          flex={1}
          textAlign="center"
          size="lg"
          bold
          typography="title"
          color="$fg"
          accessibilityRole="header">
          {title}
        </Text>
        <Box width="$target">{actionButton}</Box>
      </HStack>
    );
  }

  return (
    <VStack gap="$0.5" paddingHorizontal={gutter} paddingTop="$1" paddingBottom="$3.5">
      {(hasBack || action) && (
        <HStack alignItems="center">
          {hasBack && <BackLink onPress={handleBack} label={backLabel} name={destinationName} />}
          {actionButton && <Box marginStart="auto">{actionButton}</Box>}
        </HStack>
      )}
      <Text size="4xl" bold typography="title" color="$fg" accessibilityRole="header">
        {title}
      </Text>
      {subtitle && (
        <Text size="sm" typography="helper" color="$mutedSky">
          {subtitle}
        </Text>
      )}
    </VStack>
  );
};
