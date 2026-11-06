import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Keyboard } from "react-native";
import { Globe, Search } from "lucide-react-native";

// Components
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { IconTile } from "@/components/ui/icon-tile";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { VStack } from "@/components/ui/vstack";
import CitiesPackRow from "@/components/location/CitiesPackRow";

// Hooks
import { useCitySearch } from "@/hooks/useCitySearch";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";
import { isRunning, useLocationUpdateStore } from "@/stores/locationUpdate";

// Constants
import { CITY_SEARCH_STATUS } from "@/constants/Cities";
import { E2E_ID } from "@/constants/E2E";

// Utils
import { formatCityLabel } from "@/utils/cities";

// Types
import type { CitySearchResult } from "@/types/cities";
import type { ManualLocation } from "@/types/location";

/** Test ids for the parts a test reaches. */
export const CITY_PICKER_PART = {
  PROMPT: "city-picker-prompt",
  NONE: "city-picker-none",
  SKELETON: "city-picker-skeleton",
} as const;

/** Rows held in place while the first search of a word runs. */
const SKELETON_ROWS = ["first", "second"] as const;

const ROW = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

const toManualLocation = (city: CitySearchResult): ManualLocation => ({
  cityId: city.gid,
  name: city.name,
  names: city.names,
  region: city.region,
  countryCode: city.countryCode,
  country: city.country,
  latitude: city.latitude,
  longitude: city.longitude,
  timezone: city.timezone,
});

type NoteProps = { testID: string; title: string; body: string; children?: ReactNode };

/** What stands in place of the rows: the state, and any way on. */
const SearchNote = ({ testID, title, body, children }: NoteProps) => {
  const { t } = useTranslation();
  return (
    <Card testID={testID} alignItems="center" gap="$2" paddingVertical="$5">
      <IconTile icon={Search} />
      <VStack
        alignItems="center"
        gap="$1"
        accessible
        accessibilityLabel={t("a11y.sentences", { first: title, second: body })}>
        <Text size="md" fontWeight="600" color="$fg" textAlign="center">
          {title}
        </Text>
        <Text size="sm" color="$muted" textAlign="center">
          {body}
        </Text>
      </VStack>
      {children}
    </Card>
  );
};

/** Two rows' worth of placeholder, drawn and never read. */
const SkeletonRows = () => {
  const bone = useThemeColor("$track");
  return (
    <Box accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ListGroup>
        {SKELETON_ROWS.map((row) => (
          <HStack key={row} testID={CITY_PICKER_PART.SKELETON} alignItems="center" {...ROW.frame}>
            <VStack flex={1} gap="$2">
              <Box width="42%" height="$2">
                <Skeleton variant="circular" startColor={bone} />
              </Box>
              <Box width="64%" height="$2">
                <Skeleton variant="circular" startColor={bone} />
              </Box>
            </VStack>
          </HStack>
        ))}
      </ListGroup>
    </Box>
  );
};

type RowsProps = {
  results: CitySearchResult[];
  onPick: (city: CitySearchResult) => void;
  /** An update runs; a pick now would be dropped. */
  busy: boolean;
};

const ResultRows = ({ results, onPick, busy }: RowsProps) => {
  const { t, i18n } = useTranslation();
  return (
    <ListGroup>
      {results.map((city) => {
        const label = formatCityLabel(city, i18n.language);
        return (
          <ListRow
            key={city.gid}
            variant={LIST_ROW_VARIANT.GROUPED}
            title={label.city}
            status={label.secondary}
            hint={t("a11y.location.picker.selectCityHint")}
            testID={E2E_ID.CITY_RESULT}
            disabled={busy}
            onPress={() => onPick(city)}
          />
        );
      })}
    </ListGroup>
  );
};

type Props = {
  /** A city was chosen; the host applies it and says what happens next. */
  onPick: (place: ManualLocation) => void;
  onEnterCoordinates: () => void;
};

/** City search in Arabic or English; the host decides what a pick does. */
const CityPicker = ({ onPick, onEnterCoordinates }: Props) => {
  const { t } = useTranslation();
  const { query, setQuery, results, status, foundNothing, reachedLimit, retry, offersFullPack } =
    useCitySearch();
  const busy = useLocationUpdateStore((state) => isRunning(state.run));
  const refreshInstalled = useCitiesPackStore((state) => state.refreshInstalled);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const outcome =
    status !== CITY_SEARCH_STATUS.DONE
      ? null
      : results.length === 0
        ? t("location.picker.noneTitle")
        : t(reachedLimit ? "location.picker.resultCountCapped" : "location.picker.resultCount", {
            count: results.length,
          });

  // What a search found is said on both platforms once it lands.
  useEffect(() => {
    if (outcome) AccessibilityInfo.announceForAccessibility(outcome);
  }, [outcome]);

  const pick = (city: CitySearchResult) => {
    Keyboard.dismiss();
    onPick(toManualLocation(city));
  };

  const enterCoordinates = t("location.picker.enterCoordinates");
  const coordinatesHint = t("a11y.location.picker.enterCoordinatesHint");

  const noneNote = (
    <SearchNote
      testID={CITY_PICKER_PART.NONE}
      title={t("location.picker.noneTitle")}
      body={t("location.picker.noneHint")}>
      <Button
        action="secondary"
        variant="outline"
        marginTop="$2"
        alignSelf="stretch"
        onPress={onEnterCoordinates}
        accessibilityLabel={enterCoordinates}
        accessibilityHint={coordinatesHint}>
        <Button.Icon as={Globe} />
        <Button.Text>{enterCoordinates}</Button.Text>
      </Button>
    </SearchNote>
  );

  const body = () => {
    switch (status) {
      case CITY_SEARCH_STATUS.IDLE:
        return (
          <SearchNote
            testID={CITY_PICKER_PART.PROMPT}
            title={t("location.picker.promptTitle")}
            body={t("location.picker.searchExample")}
          />
        );
      case CITY_SEARCH_STATUS.SEARCHING:
      case CITY_SEARCH_STATUS.DONE:
        // The last answer holds while the next search runs.
        if (results.length > 0) return <ResultRows results={results} onPick={pick} busy={busy} />;
        if (foundNothing) return noneNote;
        return <SkeletonRows />;
      case CITY_SEARCH_STATUS.FAILED:
        return (
          <StatePanel
            title={t("location.picker.searchFailed.title")}
            body={t("location.picker.searchFailed.body")}
            action={{ label: t("common.retry"), onPress: retry }}
          />
        );
      default: {
        const unhandled: never = status;
        return unhandled;
      }
    }
  };

  return (
    <VStack gap="$section">
      <VStack gap="$3">
        <SearchField
          testID={E2E_ID.CITY_SEARCH_INPUT}
          value={query}
          onChangeText={setQuery}
          placeholder={t("location.picker.searchPlaceholder")}
          status={
            status === CITY_SEARCH_STATUS.SEARCHING ? t("location.picker.searching") : undefined
          }
          autoFocus
        />
        {body()}
      </VStack>
      {offersFullPack ? <CitiesPackRow /> : null}
      {/* With no city found, the way to coordinates is in the note itself. */}
      {foundNothing ? null : (
        <Button
          variant="link"
          onPress={onEnterCoordinates}
          accessibilityLabel={enterCoordinates}
          accessibilityHint={coordinatesHint}>
          <Button.Text>{enterCoordinates}</Button.Text>
        </Button>
      )}
    </VStack>
  );
};

export default CityPicker;
