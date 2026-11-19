import { screen } from "@testing-library/react-native";

import MiniPlayerBar from "@/components/athkar/MiniPlayerBar";
import { ATHKAR_GROUP_ORDER, ATHKAR_TYPE, type AthkarGroupOrder } from "@/constants/Athkar";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import type { Athkar, AthkarState } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { textIndexAt, textTurnAt, toSessionItems } from "@/utils/athkarSession";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
const mockAthkar: { state: Partial<AthkarState> } = { state: {} };
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: (select: (state: Partial<AthkarState>) => unknown) => select(mockAthkar.state),
}));
jest.mock("@/stores/athkar-audio", () => ({
  useAthkarAudioStore: Object.assign(
    (select: (state: object) => unknown) =>
      select({ comfortMode: false, duration: 0, position: 0, playbackRate: 1 }),
    { getState: () => ({ setShowBottomSheet: jest.fn() }) }
  ),
}));
// The player opens native audio; the bar only reads the store.
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: {} }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);

const QULS: Athkar = {
  id: "2",
  title: "",
  text: "",
  count: 9,
  type: ATHKAR_TYPE.MORNING,
  order: 2,
  group: { texts: ["a", "b", "c"], audioIds: ["a", "b", "c"], itemsPerRound: 3 },
};
const COUNT = 3;

/** The Quls playing at COUNT, with the progress the turn rule gives that count. */
const playing = (groupOrder: AthkarGroupOrder) => {
  const [item] = toSessionItems([QULS], groupOrder);
  const { turn, of } = textTurnAt(item, COUNT);
  mockAthkar.state = {
    playerState: PLAYER_STATE.PLAYING,
    sessionProgress: { current: 2, total: 20 },
    groupProgress: {
      groupIndex: textIndexAt(item, COUNT),
      itemsPerRound: 3,
      round: turn,
      totalRounds: of,
      count: COUNT,
      totalCount: QULS.count,
    },
    settings: {
      autoMoveToNext: true,
      showStreak: true,
      showTranslation: true,
      look: null,
      groupOrder,
    },
  };
};

beforeEach(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

describe("the mini player's group turn", () => {
  test("by round, names the round and the text that round has reached", async () => {
    playing(ATHKAR_GROUP_ORDER.BY_ROUND);
    await renderWithTheme(<MiniPlayerBar />);

    expect(screen.getByText("Round 2/3")).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.group.labels.0"))).toBeOnTheScreen();
  });

  test("each in full, names the repeat of the text playing", async () => {
    playing(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
    await renderWithTheme(<MiniPlayerBar />);

    expect(screen.getByText("1 / 3 repeats")).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.group.labels.1"))).toBeOnTheScreen();
  });
});
