import { RefreshCw, Settings, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type CompassIssueCardProps = {
  title: string;
  body: string;
  action: "retry" | "settings" | "calibrate" | null;
  isRefreshing?: boolean;
  onAction?: () => void;
};

export const CompassIssueCard = ({
  title,
  body,
  action,
  isRefreshing = false,
  onAction,
}: CompassIssueCardProps) => {
  const { t } = useTranslation();
  const actionLabel =
    action === "settings"
      ? t("compass.action.openSettings")
      : action === "calibrate"
        ? t("compass.action.calibrate")
        : t("compass.action.retry");
  const actionA11yLabel =
    action === "settings"
      ? t("a11y.compass.openSettings")
      : action === "calibrate"
        ? t("compass.action.calibrate")
        : t("a11y.compass.retry");
  const actionA11yHint =
    action === "settings"
      ? t("a11y.compass.openSettingsHint")
      : action === "calibrate"
        ? t("compass.calibrationNote")
        : t("a11y.compass.retryHint");
  const ActionIcon = action === "settings" ? Settings : RefreshCw;

  return (
    <Card
      width="100%"
      maxWidth={420}
      padding="$6"
      gap="$4"
      borderWidth={1}
      borderColor="$borderWarning"
      backgroundColor="$backgroundWarning"
      accessibilityLiveRegion="assertive">
      <VStack gap="$3" alignItems="center">
        <Icon as={TriangleAlert} size="xl" color="$warning" />
        <Text size="xl" bold textAlign="center" color="$typography" accessibilityRole="header">
          {title}
        </Text>
        <Text color="$typographySecondary" textAlign="center">
          {body}
        </Text>
      </VStack>

      {action === "calibrate" && (
        <Text size="sm" color="$typography" textAlign="center">
          {t("compass.calibrationNote")}
        </Text>
      )}

      {action && onAction && (
        <Button
          size="lg"
          width="100%"
          disabled={isRefreshing}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionA11yLabel}
          accessibilityHint={actionA11yHint}
          accessibilityState={{ disabled: isRefreshing }}>
          {isRefreshing ? <Button.Spinner /> : <Button.Icon as={ActionIcon} />}
          <Button.Text>{actionLabel}</Button.Text>
        </Button>
      )}
    </Card>
  );
};
