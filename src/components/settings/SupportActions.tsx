import { AccessibilityInfo, Linking, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Share2, Star } from "lucide-react-native";

import { MessageToast } from "@/components/feedback/MessageToast";
import { SupportTile } from "@/components/settings/SupportTile";
import { Grid } from "@/components/ui/grid";
import { VStack } from "@/components/ui/vstack";
import { STORE_LINKS } from "@/constants/StoreLinks";
import { PlatformType } from "@/enums/app";
import { useHaptic } from "@/hooks/useHaptic";
import { useOnReturn } from "@/hooks/useOnReturn";
import { useThankYou } from "@/hooks/useThankYou";

const isIOS = () => Platform.OS === PlatformType.IOS;

/** Opens the app's store page; Android falls back to its web listing. */
const openStore = () =>
  isIOS()
    ? Linking.openURL(STORE_LINKS.iosReview)
    : Linking.openURL(STORE_LINKS.android).catch(() =>
        Linking.openURL(STORE_LINKS.androidFallback)
      );

/** Rate and Share, each thanking the user once the action is done. */
export const SupportActions = () => {
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");
  const onReturn = useOnReturn();
  const [rateThanked, thankRate] = useThankYou();
  const [shareThanked, thankShare] = useThankYou();

  const thank = (show: () => void) => {
    show();
    AccessibilityInfo.announceForAccessibility(t("settings.thankYou"));
  };

  // The store leaves the app, so its return is the only sign of a rating.
  const rate = () => {
    hapticMedium();
    openStore()
      .then(() => onReturn(() => thank(thankRate)))
      .catch(() => {});
  };

  // Android's share sheet reports no outcome; iOS reports a dismissal.
  const share = () => {
    hapticMedium();
    const sharing = Share.share({ message: t("settings.shareMessage") });
    if (!isIOS()) {
      sharing.catch(() => {});
      onReturn(() => thank(thankShare));
      return;
    }
    sharing
      .then((result) => {
        if (result.action !== Share.dismissedAction) thank(thankShare);
      })
      .catch(() => {});
  };

  const copyLink = async () => {
    hapticMedium();
    try {
      await Clipboard.setStringAsync(STORE_LINKS.share);
      MessageToast.showSuccess(t("settings.linkCopied"));
    } catch {
      // Nothing was copied, so nothing is confirmed.
    }
  };

  return (
    <VStack padding="$2.5">
      <Grid columns={2} gap="$2">
        <Grid.Item>
          <SupportTile
            icon={Star}
            ink="$warn"
            label={t("settings.rateApp")}
            thanksLabel={t("settings.thankYou")}
            thanked={rateThanked}
            hint={t("a11y.settings.rateHint")}
            onPress={rate}
          />
        </Grid.Item>
        <Grid.Item>
          <SupportTile
            icon={Share2}
            ink="$accent"
            label={t("settings.shareApp")}
            thanksLabel={t("settings.thankYou")}
            thanked={shareThanked}
            hint={t("a11y.settings.shareHint")}
            onPress={share}
            onLongPress={copyLink}
          />
        </Grid.Item>
      </Grid>
    </VStack>
  );
};
