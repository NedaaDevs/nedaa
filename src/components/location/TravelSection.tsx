import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { HStack } from "@/components/ui/hstack";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TRAVEL_MODE, type TravelMode } from "@/constants/CityCheck";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SECTION_KIND } from "@/constants/Section";
import { useHaptic } from "@/hooks/useHaptic";
import { useMarkPlace } from "@/hooks/useMarkPlace";
import { usePlace } from "@/hooks/usePlace";
import { useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import type { PlaceMark } from "@/types/cityCheck";
import { markPoint } from "@/utils/cityCheck/marks";
import { distanceBetween } from "@/utils/location";

const GROUPED_STYLE = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

/** One place the offer stays quiet in, with the way to hear of it again. */
const NotAskedRow = ({ mark, saved }: { mark: PlaceMark; saved: string | undefined }) => {
  const { t } = useTranslation();
  const askAgainIn = useCityCheckStore((state) => state.askAgainIn);
  const savedPoint = useLocationStore((state) => state.locationDetails.coords);
  const named = useMarkPlace(mark)?.city;
  const distance = Math.round(distanceBetween(savedPoint, markPoint(mark)));
  const place =
    named ??
    (saved
      ? t("location.travel.notAsked.near", { distance, saved })
      : t("location.travel.notAsked.nearNoSavedName", { distance }));
  const askAgainHint = named
    ? t("a11y.location.travel.askAgainHint", { place: named })
    : saved
      ? t("a11y.location.travel.askAgainNearHint", { distance, saved })
      : t("a11y.location.travel.askAgainNearNoSavedNameHint", { distance });

  return (
    <HStack alignItems="center" gap="$3" {...GROUPED_STYLE.frame}>
      <Text {...GROUPED_STYLE.title} color="$fg" flex={1}>
        {place}
      </Text>
      <Button
        variant="link"
        size="sm"
        onPress={() => askAgainIn(mark)}
        accessibilityLabel={t("location.travel.notAsked.askAgain")}
        accessibilityHint={askAgainHint}>
        <Button.Text>{t("location.travel.notAsked.askAgain")}</Button.Text>
      </Button>
    </HStack>
  );
};

/** What happens on opening in another city; the places left unasked. */
export const TravelSection = () => {
  const { t } = useTranslation();
  const lightHaptic = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const travelMode = useLocationStore((state) => state.travelMode);
  const setTravelMode = useLocationStore((state) => state.setTravelMode);
  const notAsked = useCityCheckStore((state) => state.cityCheck.notAsked);
  const savedCity = usePlace().city;
  const label = t("location.settings.travelSection");

  const choose = (mode: TravelMode) => {
    void lightHaptic();
    setTravelMode(mode);
  };

  return (
    <VStack gap="$3.5">
      <Section title={label} kind={SECTION_KIND.LABEL}>
        <ChoiceGroup label={label} variant={LIST_ROW_VARIANT.GROUPED}>
          <ChoiceRow
            title={t("location.travel.ask.title")}
            subtitle={t("location.travel.ask.note")}
            selected={travelMode === TRAVEL_MODE.ASK}
            onPress={() => choose(TRAVEL_MODE.ASK)}
          />
          <ChoiceRow
            title={t("location.travel.auto.title")}
            pill={t("location.travel.comingLater")}
            selected={false}
            onPress={() => {}}
            disabled
          />
          <ChoiceRow
            title={t("location.travel.off.title")}
            subtitle={
              savedCity
                ? t("location.travel.off.note", { city: savedCity })
                : t("location.travel.off.noteNoSavedName")
            }
            selected={travelMode === TRAVEL_MODE.OFF}
            onPress={() => choose(TRAVEL_MODE.OFF)}
          />
        </ChoiceGroup>
      </Section>
      {notAsked.length > 0 ? (
        <Section title={t("location.travel.notAsked.title")} kind={SECTION_KIND.LABEL}>
          <ListGroup>
            {notAsked.map((mark) => (
              <NotAskedRow
                key={`${mark.lat},${mark.lng},${mark.at}`}
                mark={mark}
                saved={savedCity}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
    </VStack>
  );
};
