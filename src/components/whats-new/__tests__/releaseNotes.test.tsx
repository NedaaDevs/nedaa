import { Component } from "react";
import { AccessibilityInfo, PixelRatio } from "react-native";
import { act, screen, userEvent, within } from "@testing-library/react-native";

import { ReleaseNotesCard } from "@/components/about/ReleaseNotesCard";
import { RELEASE_NOTE_PART, ReleaseNoteCard } from "@/components/whats-new/ReleaseNoteCard";
import { ReleaseNotesList } from "@/components/whats-new/ReleaseNotesList";
import { VERSION_PILL_ID } from "@/components/whats-new/VersionPill";
import WhatsNewSheet, { PRESENT_DELAY_MS } from "@/components/WhatsNewSheet";
import {
  ALL_WHATS_NEW_IDS,
  WHATS_NEW_ACTION,
  WhatsNewId,
  getApplicableEntries,
  type WhatsNewEntry,
} from "@/constants/WhatsNew";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useWhatsNewSheetStore } from "@/stores/whatsNewSheet";
import { appVersion } from "@/utils/appVersion";
import { LTR_ISOLATE } from "@/utils/digits";
import { formatNumberToLocale } from "@/utils/number";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const hidden = { includeHiddenElements: true };

/** The entries every test context gets, in the order they ship. */
const applicable = () =>
  getApplicableEntries({
    umrahInProgress: false,
    fontScale: PixelRatio.getFontScale(),
    textSizeOfferHandled: false,
  });

/** One card's name for a reader: its place, title and body. */
const cardName = (entry: WhatsNewEntry, n: number) =>
  i18n.t("a11y.whatsNew.entry", {
    n: formatNumberToLocale(String(n)),
    title: i18n.t(entry.titleKey),
    body: i18n.t(entry.descriptionKey),
  });

/** The names of the cards on screen, top to bottom. */
const shownCards = () =>
  screen
    .getAllByTestId(RELEASE_NOTE_PART.TEXT, hidden)
    .map((node) => node.props.accessibilityLabel as string);

const navigateEntry = (): WhatsNewEntry => {
  const entry = applicable().find(({ action }) => action.type === WHATS_NEW_ACTION.NAVIGATE);
  if (!entry) throw new Error("no entry leads to a screen");
  return entry;
};

/** A screen entry's button, named for the feature it opens. */
const opensName = (entry: WhatsNewEntry) => i18n.t("a11y.opens", { name: i18n.t(entry.titleKey) });

/** An opt-in entry's button, named for the feature it turns on. */
const enableName = (entry: WhatsNewEntry) =>
  i18n.t("a11y.whatsNew.enable", { title: i18n.t(entry.titleKey) });

const optInEntry = (enable = jest.fn()): WhatsNewEntry => ({
  id: WhatsNewId.IMPORTANT_DAYS,
  titleKey: "whatsNew.importantDays.title",
  descriptionKey: "whatsNew.importantDays.description",
  action: {
    type: WHATS_NEW_ACTION.OPT_IN,
    ctaKey: "whatsNew.enable",
    isEnabled: () => false,
    enable,
  },
});

const openFromAbout = () => act(() => useWhatsNewSheetStore.getState().requestOpen());

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({ hasHydrated: true, isFirstRun: true, dismissedFeatureCards: [] });
  usePreferencesStore.setState({ textSizeOfferHandled: false });
  useUmrahGuideStore.setState({ activeProgress: null });
});

describe("ReleaseNoteCard", () => {
  it("reads its place, title and body as one element", async () => {
    const entry = navigateEntry();
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={2} onNavigate={jest.fn()} onSettled={jest.fn()} />
    );

    expect(screen.getByLabelText(cardName(entry, 2))).toBeTruthy();
  });

  it("hands a screen entry to onNavigate from its own button", async () => {
    const entry = navigateEntry();
    const onNavigate = jest.fn();
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={1} onNavigate={onNavigate} onSettled={jest.fn()} />
    );

    await userEvent.press(screen.getByRole("button", { name: opensName(entry) }));

    expect(onNavigate).toHaveBeenCalledWith(entry);
  });

  it("turns an opt-in feature on and settles the entry", async () => {
    const enable = jest.fn();
    const onSettled = jest.fn();
    const entry = optInEntry(enable);
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={1} onNavigate={jest.fn()} onSettled={onSettled} />
    );

    await userEvent.press(screen.getByRole("button", { name: enableName(entry) }));

    expect(enable).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(entry);
    expect(screen.getByLabelText(i18n.t("whatsNew.enabled"))).toBeTruthy();
  });

  it("reads the enabled state as one element", async () => {
    const entry = { ...optInEntry(), action: { ...optInEntry().action, isEnabled: () => true } };
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={1} onNavigate={jest.fn()} onSettled={jest.fn()} />
    );

    const state = screen.getByLabelText(i18n.t("whatsNew.enabled"));
    expect(state.props.accessible).toBe(true);
    expect(within(state).queryByText(i18n.t("whatsNew.enabled"))).toBeTruthy();
  });

  it("settles an opt-in entry on Not now without turning it on", async () => {
    const enable = jest.fn();
    const onSettled = jest.fn();
    const entry = optInEntry(enable);
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={1} onNavigate={jest.fn()} onSettled={onSettled} />
    );

    await userEvent.press(screen.getByRole("button", { name: i18n.t("whatsNew.notNow") }));

    expect(enable).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(entry);
    expect(screen.queryByRole("button", { name: enableName(entry) })).toBeNull();
    expect(screen.queryByText(i18n.t("whatsNew.notNow"))).toBeNull();
  });
});

describe("ReleaseNotesList", () => {
  it("numbers its entries from one, in order", async () => {
    const entries = applicable();
    await renderWithTheme(
      <ReleaseNotesList entries={entries} onNavigate={jest.fn()} onSettled={jest.fn()} />
    );

    expect(shownCards()).toEqual(entries.map((entry, i) => cardName(entry, i + 1)));
  });

  it("says so when no entry applies", async () => {
    await renderWithTheme(
      <ReleaseNotesList entries={[]} onNavigate={jest.fn()} onSettled={jest.fn()} />
    );

    expect(screen.getByText(i18n.t("whatsNew.empty"))).toBeTruthy();
  });
});

describe("WhatsNewSheet", () => {
  it("lists every entry that applies when opened from About, seen ones too", async () => {
    useAppStore.setState({ dismissedFeatureCards: [...ALL_WHATS_NEW_IDS] });
    await renderWithTheme(<WhatsNewSheet />);

    await openFromAbout();

    expect(shownCards()).toEqual(applicable().map((entry, i) => cardName(entry, i + 1)));
  });

  it("heads the sheet with its title and the installed version", async () => {
    await renderWithTheme(<WhatsNewSheet />);

    await openFromAbout();

    expect(screen.getByRole("header", { name: i18n.t("whatsNew.title") })).toBeTruthy();
    expect(screen.getByText(i18n.t("whatsNew.title"))).toHaveStyle({ textAlign: "center" });
    expect(
      within(screen.getByTestId(VERSION_PILL_ID)).getByText(
        `${LTR_ISOLATE.OPEN}${appVersion()}${LTR_ISOLATE.CLOSE}`
      )
    ).toBeTruthy();
  });

  it("changes no seen state on opening; Done marks what it showed as seen", async () => {
    await renderWithTheme(<WhatsNewSheet />);

    await openFromAbout();
    expect(useAppStore.getState().dismissedFeatureCards).toEqual([]);

    await userEvent.press(screen.getByRole("button", { name: i18n.t("whatsNew.done") }));

    expect([...useAppStore.getState().dismissedFeatureCards].sort()).toEqual(
      applicable()
        .map(({ id }) => id)
        .sort()
    );
  });

  it("hands reader focus back to the About card once it closes", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation();
    await renderWithTheme(
      <>
        <ReleaseNotesCard />
        <WhatsNewSheet />
      </>
    );
    const aboutName = i18n.t("a11y.about.release", { version: appVersion() });

    await userEvent.press(screen.getByRole("button", { name: aboutName }));
    await userEvent.press(screen.getByRole("button", { name: i18n.t("whatsNew.done") }));

    // jest's View mock hands a ref its component, props included.
    const [node, event] = focus.mock.lastCall ?? [];
    expect(node instanceof Component && node.props.accessibilityLabel).toBe(aboutName);
    expect(event).toBe("focus");
    focus.mockRestore();
  });

  it("opens an entry's screen and marks only that entry seen", async () => {
    const entry = navigateEntry();
    await renderWithTheme(<WhatsNewSheet />);
    await openFromAbout();

    if (entry.action.type !== WHATS_NEW_ACTION.NAVIGATE) throw new Error("not a screen entry");
    const card = screen.getByTestId(`${RELEASE_NOTE_PART.CARD}-${entry.id}`);
    await userEvent.press(within(card).getByRole("button", { name: opensName(entry) }));

    expect(mockPush).toHaveBeenCalledWith(entry.action.route);
    expect(useAppStore.getState().dismissedFeatureCards).toEqual([entry.id]);
  });
});

// One concept, one component: both ways into the release notes draw the
// same entries with the same card, and the version with the same pill.
describe("Release notes, one renderer", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("draws the launch announcement and the About list with the same cards", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    useAppStore.setState({ isFirstRun: false });
    await renderWithTheme(<WhatsNewSheet />);

    await act(() => jest.advanceTimersByTime(PRESENT_DELAY_MS));
    const announced = shownCards();
    await user.press(screen.getByRole("button", { name: i18n.t("whatsNew.done") }));
    await openFromAbout();

    expect(announced.length).toBeGreaterThan(0);
    expect(shownCards()).toEqual(announced);
  });

  it("marks the version with the same pill on the About card and the sheet", async () => {
    await renderWithTheme(
      <>
        <ReleaseNotesCard />
        <WhatsNewSheet />
      </>
    );
    await openFromAbout();

    const pills = screen.getAllByTestId(VERSION_PILL_ID, hidden);
    expect(pills).toHaveLength(2);
    const [card, sheet] = pills.map((pill) => within(pill).getByText(/./, hidden).props.children);
    expect(sheet).toBe(card);
  });
});
