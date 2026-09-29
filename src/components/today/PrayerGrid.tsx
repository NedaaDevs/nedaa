import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { PRAYER_ICONS } from "@/components/today/prayerIcons";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PRAYER_CARD_STATE } from "@/constants/PrayerCard";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { prayerCards, type PrayerCard } from "@/utils/prayerCards";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

type CardProps = {
  card: PrayerCard;
  name: string;
  time: string;
  selected: boolean;
  onPress: () => void;
};

/** One prayer: quiet once passed, accented when next, ringed when chosen. */
const PrayerCardView = ({ card, name, time, selected, onPress }: CardProps) => {
  const { t } = useTranslation();
  const current = card.state === PRAYER_CARD_STATE.CURRENT;
  // The one gold card: the prayer just come in, else the next.
  const next = current || card.state === PRAYER_CARD_STATE.NEXT;
  const past = card.state === PRAYER_CARD_STATE.PAST;

  return (
    <Pressable
      onPress={onPress}
      // The state shows only as colour on screen, so the label carries it.
      accessibilityLabel={t(
        current
          ? "a11y.today.prayerCardCurrent"
          : next
            ? "a11y.today.prayerCardNext"
            : "a11y.today.prayerCard",
        {
          prayer: name,
          time,
        }
      )}
      accessibilityState={{ selected }}
      flexDirection="row"
      alignItems="center"
      gap="$2"
      minHeight="$16"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$card"
      borderWidth={selected ? 2 : 1}
      borderColor={selected || next ? "$accent" : "$border"}
      backgroundColor={next ? "$accentSoft" : past ? "transparent" : "$surface2"}>
      <Box opacity={past ? 0.55 : 1}>
        <Icon as={PRAYER_ICONS[card.id]} size="lg" color={next ? "$accent" : "$muted"} />
      </Box>
      {/* A long name wraps; the card grows past its floor. */}
      <VStack flexShrink={1}>
        <Text size="lg" fontWeight="600" color={next ? "$accent" : past ? "$mutedSky" : "$fg"}>
          {name}
        </Text>
        <Text size="lg" fontWeight="600" numeric color={past ? "$mutedSky" : "$fg"}>
          {time}
        </Text>
      </VStack>
    </Pressable>
  );
};

type Props = {
  /** The prayer chosen on Today, ringed here and lit on the day's line. */
  selected?: PrayerId;
  onSelect: (id: PrayerId) => void;
};

/** The day's five prayers: the next one wide on top, the others two by two. */
export const PrayerGrid = ({ selected, onSelect }: Props) => {
  const { t } = useTranslation();
  const { now, day, following } = useShownDay();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!day) return null;

  const { wide, rest } = prayerCards(day, now, following);
  const friday = isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone);
  const view = (card: PrayerCard) => (
    <PrayerCardView
      card={card}
      name={t(prayerNameKey(card.id, friday))}
      time={localizeDigits(
        formatPrayerTime(card.time, day.timezone, { locale, use24HourTime }),
        locale,
        western
      )}
      selected={card.id === selected}
      onPress={() => onSelect(card.id)}
    />
  );

  // Keyed by prayer, so when the next one changes its card glides to the top.
  return (
    <Grid columns={2} gap="$2">
      {[wide, ...rest].map((card) => (
        <Grid.Item key={card.id} wide={card === wide}>
          {view(card)}
        </Grid.Item>
      ))}
    </Grid>
  );
};
