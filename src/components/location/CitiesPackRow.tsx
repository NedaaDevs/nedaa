import { useTranslation } from "react-i18next";
import { AccessibilityInfo } from "react-native";
import { CircleAlert, Download, RefreshCw } from "lucide-react-native";

// Components
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { Pressable } from "@/components/ui/pressable";
import { Meter } from "@/components/ui/meter";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";
import { usePreferencesStore } from "@/stores/preferences";

// Constants
import {
  CITIES_FULL_CITY_COUNT,
  CITIES_PACK_BYTES,
  CITIES_SEED_CITY_COUNT,
} from "@/constants/Cities";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";

// Utils
import { countText } from "@/utils/digits";

/** Test ids for the parts a test reaches. */
export const CITIES_PACK_PART = { OFFER: "cities-pack-offer" } as const;

/** A row of the list group, laid out as every grouped row is. */
const ROW = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

/** Megabytes to one decimal place, the unit said by the copy around it. */
const megabytes = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

/** A count in the digits the reader keeps, grouped as those digits are. */
const useCountText = (count: number) => {
  const { i18n } = useTranslation();
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  return countText(count, i18n.language, western);
};

/** What search covers until the full list is installed. */
const SeedNote = () => {
  const { t } = useTranslation();
  const amount = useCountText(CITIES_SEED_CITY_COUNT);
  return (
    // Drawn on the bare sky, where plain muted ink falls short of AA.
    <Text size="helper" color="$mutedSky" paddingHorizontal="$1">
      {t("location.picker.seedCoverage", { count: CITIES_SEED_CITY_COUNT, amount })}
    </Text>
  );
};

/** The standing offer: what the full list holds and what it costs. */
const Offer = ({ onDownload }: { onDownload: () => void }) => {
  const { t } = useTranslation();
  const amount = useCountText(CITIES_FULL_CITY_COUNT);
  const title = t("location.picker.packDownload");
  const detail = t("location.picker.packDetail", {
    count: CITIES_FULL_CITY_COUNT,
    amount,
    size: megabytes(CITIES_PACK_BYTES),
  });
  return (
    <Pressable
      testID={CITIES_PACK_PART.OFFER}
      onPress={onDownload}
      accessibilityLabel={t("a11y.join", { first: title, second: detail })}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...ROW.frame}
      pressStyle={ROW.press}>
      <IconTile icon={Download} />
      <VStack flex={1}>
        <Text {...ROW.title} color="$fg">
          {title}
        </Text>
        <Text {...ROW.status} color="$muted">
          {detail}
        </Text>
      </VStack>
    </Pressable>
  );
};

type DownloadingProps = { receivedBytes: number; totalBytes: number; onCancel: () => void };

/** The download running: how far it is, and the way to stop it. */
const Downloading = ({ receivedBytes, totalBytes, onCancel }: DownloadingProps) => {
  const { t } = useTranslation();
  // The CDN may omit the length; the declared size stands in.
  const total = totalBytes > 0 ? totalBytes : CITIES_PACK_BYTES;
  const title = t("location.picker.packDownloading");
  // The title is said once; the changing megabytes are read on focus.
  useIosAnnouncement(title);
  return (
    <HStack alignItems="center" gap="$3" {...ROW.frame}>
      <IconTile icon={Download} />
      <VStack flex={1} gap="$1">
        <Text {...ROW.title} color="$fg" accessibilityLiveRegion="polite">
          {title}
        </Text>
        <Text {...ROW.status} color="$muted">
          {t("location.picker.packProgress", {
            received: megabytes(receivedBytes),
            total: megabytes(total),
          })}
        </Text>
        {/* A filling bar, not a spinner: nothing for Reduce Motion to stop. */}
        <Meter value={Math.round((receivedBytes / total) * 100)} max={100} label={title} />
      </VStack>
      <Button
        size="sm"
        action="secondary"
        variant="outline"
        onPress={onCancel}
        accessibilityLabel={t("a11y.location.picker.cancelDownload")}>
        <Button.Text>{t("location.picker.packCancel")}</Button.Text>
      </Button>
    </HStack>
  );
};

/** Why the download stopped, a retry, and what search still covers. */
const Failed = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();
  const failure = t("location.picker.packFailedBody");
  const retry = t("common.retry");
  useIosAnnouncement(failure);
  return (
    <VStack gap="$3" padding="$cardPad">
      <HStack
        alignItems="flex-start"
        gap="$2"
        accessible
        accessibilityLabel={failure}
        accessibilityLiveRegion="polite">
        <Icon as={CircleAlert} size="sm" color="$danger" />
        <Text size="sm" fontWeight="600" color="$fg" flex={1}>
          {failure}
        </Text>
      </HStack>
      <Button action="secondary" variant="outline" onPress={onRetry} accessibilityLabel={retry}>
        <Button.Icon as={RefreshCw} />
        <Button.Text>{retry}</Button.Text>
      </Button>
      <SeedNote />
    </VStack>
  );
};

/** The full city list, offered while only the major cities are installed. */
const CitiesPackRow = () => {
  const { t } = useTranslation();
  const mediumHaptic = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const isDownloading = useCitiesPackStore((state) => state.isDownloading);
  const receivedBytes = useCitiesPackStore((state) => state.receivedBytes);
  const totalBytes = useCitiesPackStore((state) => state.totalBytes);
  const failed = useCitiesPackStore((state) => state.error !== null);
  const download = useCitiesPackStore((state) => state.download);
  const cancel = useCitiesPackStore((state) => state.cancel);

  const start = async () => {
    void mediumHaptic();
    await download();
    // The row leaves once the list is installed, so the tap says it landed.
    if (useCitiesPackStore.getState().isInstalled) {
      AccessibilityInfo.announceForAccessibility(t("location.picker.packInstalled"));
    }
  };

  if (failed && !isDownloading) {
    return (
      <ListGroup>
        <Failed onRetry={() => void start()} />
      </ListGroup>
    );
  }

  return (
    <VStack gap="$2">
      <SeedNote />
      <ListGroup>
        {isDownloading ? (
          <Downloading receivedBytes={receivedBytes} totalBytes={totalBytes} onCancel={cancel} />
        ) : (
          <Offer onDownload={() => void start()} />
        )}
      </ListGroup>
    </VStack>
  );
};

export default CitiesPackRow;
