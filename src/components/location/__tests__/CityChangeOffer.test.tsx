import { AccessibilityInfo } from "react-native";
import { act, userEvent } from "@testing-library/react-native";
import { screen } from "expo-router/testing-library";

import { CityChangeOffer } from "@/components/location/CityChangeOffer";
import { NOTICE_CARD_PART } from "@/components/ui/notice-card";
import { renderWithTheme } from "@/test-helpers/theme";

import {
  CITY_OFFER_PART,
  CITY_OFFER_STAGE,
  OFFER_SHAPE,
  type OfferShape,
} from "@/constants/CityOffer";
import { APP_STATE } from "@/constants/AppState";
import { E2E_ID } from "@/constants/E2E";
import { AppLocale } from "@/enums/app";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import {
  captureAppState,
  emitAppState,
  restoreAppState,
  setAppState,
} from "@/test-helpers/appStateMock";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import {
  DUBAI_NAME,
  JEDDAH_PLACE,
  RIYADH_NAME,
  type WrittenPlace,
  button,
  label,
  renderOffer,
  resetStatus,
  savedRiyadh,
  setFocused,
  setOffline,
  t,
  unnamedSavedPlace,
  writePlace,
} from "@/test-helpers/cityOfferCard";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf } from "@/test-helpers/text";
import { DUBAI_ZONE } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { CityCandidate, CityOfferStage } from "@/types/cityCheck";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useIsOffline", () => ({
  useIsOffline: () => jest.requireActual("@/test-helpers/cityOfferCard").useOffline(),
}));
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useIsFocused: () => jest.requireActual("@/test-helpers/cityOfferCard").useFocused(),
}));
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    run: jest.requireActual("@/stores/locationUpdate").useLocationUpdateStore((s: any) => s.run),
    applyCandidate: jest.fn(),
    dismissFailure: jest.fn(),
  }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  resetStatus();
  setAppState(APP_STATE.ACTIVE);
  await act(() => i18n.changeLanguage(AppLocale.EN));
  savedRiyadh();
});

afterEach(() => {
  jest.restoreAllMocks();
  restoreAppState();
});

describe("the offer", () => {
  it("names the city the device is in over the saved city's times", async () => {
    offerUp();
    await renderOffer();
    expect(
      screen.getByLabelText(
        t("a11y.join", {
          first: t("a11y.join", {
            first: t("location.cityChange.greeting"),
            second: t("location.cityOffer.title", { city: "Jeddah" }),
          }),
          second: t("location.cityOffer.body", { saved: "Riyadh" }),
        })
      )
    ).toBeTruthy();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.useHint", { city: "Jeddah" })
    );
  });

  it("draws nothing without an offer", async () => {
    await renderOffer();
    expect(screen.queryByTestId(CITY_OFFER_PART.CARD)).toBeNull();
  });

  it("says the greeting above the title in the offer, and in no later view", async () => {
    offerUp();
    await renderOffer();
    expect(screen.getByText(t("location.cityChange.greeting"))).toBeTruthy();
    expect(label().startsWith(t("location.cityChange.greeting"))).toBe(true);
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(screen.queryByText(t("location.cityChange.greeting"))).toBeNull();
    expect(label()).not.toContain(t("location.cityChange.greeting"));
  });

  it("leaves the greeting out of the updated view", async () => {
    offerUp(candidateAt(), { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true });
    await renderOffer();
    expect(screen.queryByText(t("location.cityChange.greeting"))).toBeNull();
  });

  it("calls each city by its name in the app's language", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    offerUp();
    await renderOffer();
    expect(label()).toContain(t("location.cityOffer.title", { city: "جدة" }));
    expect(label()).toContain(t("location.cityOffer.body", { saved: "الرياض" }));
  });

  it.each([
    [DUBAI_ZONE, true],
    ["Asia/Kuwait", false],
    [null, false],
  ])("adds the zone line beside a place on %s: %s", async (zone, shown) => {
    offerUp(candidateAt({ zone, name: DUBAI_NAME }));
    await renderOffer();
    const greeting = t("location.cityChange.greeting");
    const title = t("location.cityOffer.title", { city: "Dubai" });
    const body = t("location.cityOffer.body", { saved: "Riyadh" });
    const zoneLine = t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" });
    if (shown) expect(label()).toContain(zoneLine);
    else
      expect(label()).toBe(
        t("a11y.join", { first: t("a11y.join", { first: greeting, second: title }), second: body })
      );
  });

  it("names the distance inside the same city, and drops the names from the buttons", async () => {
    offerUp(candidateAt({ name: RIYADH_NAME, distanceKm: 40.4 }));
    await renderOffer();
    expect(label()).toContain(
      t("location.cityOffer.sameName.body", { distance: 40, saved: "Riyadh" })
    );
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      t("location.cityOffer.useHere"),
      t("location.cityOffer.keepSaved"),
    ]);
  });

  it("names the distance from the saved city for an unnamed place, and offers the picker", async () => {
    offerUp(candidateAt({ name: null, distanceKm: 40 }));
    await renderOffer();
    expect(label()).toContain(
      t("location.cityOffer.unnamed.title", { distance: 40, saved: "Riyadh" })
    );
    expect(button("location.cityOffer.useHere")).toBeTruthy();
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).toBeTruthy();
    expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toBeTruthy();
  });

  it("holds Use while offline, says why last, and keeps Keep open", async () => {
    await setOffline(true);
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.offline", { city: "Jeddah" }))).toBe(true);
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).not.toBeDisabled();
  });

  it("holds Use while another update runs, with the hourglass", async () => {
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.DEVICE }, step: UPDATE_STEP.LOCATION, failed: false },
    });
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.busy"))).toBe(true);
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).not.toBeDisabled();
  });

  it("holds Use while a device read runs", async () => {
    useLocationStore.setState({ isGettingLocation: true });
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.busy"))).toBe(true);
  });

  it("opens Use again when the connection returns, with no second announcement", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await setOffline(true);
    offerUp();
    await renderOffer();
    await setOffline(false);
    expect(button("location.cityOffer.use", { city: "Jeddah" })).not.toBeDisabled();
    expect(announce).toHaveBeenCalledTimes(1);
  });
});

describe("the answers", () => {
  it("keeps the saved times on Keep, offers Don't ask, and keeps the zone line", async () => {
    offerUp(candidateAt({ zone: DUBAI_ZONE, name: DUBAI_NAME }));
    await renderOffer();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(label()).toContain(t("location.cityOffer.kept.title", { saved: "Riyadh" }));
    expect(label()).toContain(
      t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" })
    );
    expect(button("location.cityOffer.dontAsk", { city: "Dubai" })).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.dontAskHint")
    );
  });

  it("sets Don't ask as the card's text action, at the body size", async () => {
    offerUp();
    await renderOffer();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(screen.getByText(t("location.cityOffer.dontAsk", { city: "Jeddah" }))).toHaveStyle({
      fontSize: fontSizeOf("md"),
    });
  });

  it("confirms Don't ask in place and drops the action", async () => {
    offerUp();
    await renderOffer();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    await userEvent.press(button("location.cityOffer.dontAsk", { city: "Jeddah" }));
    expect(label()).toContain(t("location.cityOffer.muted.title", { city: "Jeddah" }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("calls an unnamed saved place the saved place", async () => {
    unnamedSavedPlace();
    offerUp();
    await renderOffer();
    expect(label()).toContain(t("location.cityOffer.bodyNoSavedName"));
    expect(button("location.cityOffer.keepSaved")).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.keepSavedHint")
    );
    expect(label()).not.toMatch(/undefined|null/);
    await userEvent.press(button("location.cityOffer.keepSaved"));
    expect(label()).toContain(t("location.cityOffer.kept.titleHere"));
    expect(label()).toContain(t("location.cityOffer.kept.bodyNoSavedName", { city: "Jeddah" }));
  });
});

describe("saying it", () => {
  it("is not a live region", async () => {
    offerUp();
    await renderOffer();
    expect(screen.getByTestId(NOTICE_CARD_PART.TEXT)).toHaveProp("accessibilityLiveRegion", "none");
  });

  it("moves focus to the text block after Keep and Don't ask, never on arrival", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    offerUp();
    await renderOffer();
    expect(focus).not.toHaveBeenCalled();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(focus).toHaveBeenCalledTimes(1);
    await userEvent.press(button("location.cityOffer.dontAsk", { city: "Jeddah" }));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("hides the glyph and gives every control a role, a name and a 44pt target", async () => {
    offerUp(candidateAt({ name: null }));
    await renderOffer();
    expect(controlProblems()).toEqual([]);
  });

  it("announces the offer once, from the surface on screen", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    offerUp();
    await setFocused(false);
    await renderOffer();
    expect(announce).not.toHaveBeenCalled();
    await setFocused(true);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(label());
    // A second card on one offer is a remount: the offer remembers it was said.
    await renderWithTheme(<CityChangeOffer />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(useLocationStore.getState().cityOffer?.announced).toBe(true);
  });

  it("holds the announcement until the app returns to the front", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    captureAppState();
    setAppState(APP_STATE.BACKGROUND);
    offerUp();
    await renderOffer();
    expect(announce).not.toHaveBeenCalled();
    expect(useLocationStore.getState().cityOffer?.announced).toBe(false);
    await act(async () => emitAppState(APP_STATE.ACTIVE));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(label());
    expect(useLocationStore.getState().cityOffer?.announced).toBe(true);
  });
});

/** The card's copy as a screen reader joins it, one line after another. */
const said = (...parts: string[]) =>
  parts.reduce((first, second) => t("a11y.join", { first, second }));

const DISTANCE_KM = 40;
const SAVED = { saved: "Riyadh" };
const JEDDAH = { city: "Jeddah" };
const RIYADH_PLACE: WrittenPlace = { ...JEDDAH_PLACE, city: "Riyadh" };
const UNNAMED_LANDED: WrittenPlace = { ...JEDDAH_PLACE, city: "", country: "" };

type ViewRow = {
  shape: OfferShape;
  /** What the device place is called; null leaves it unnamed. */
  candidate: Partial<CityCandidate>;
  /** The saved place has no name. */
  savedUnnamed?: boolean;
  stage: CityOfferStage;
  /** The place the update wrote, when the stage follows one. */
  landed?: WrittenPlace;
  copy: () => string;
  buttons: () => string[];
  /** The line added while offline; only the offer view holds one. */
  offline?: () => string;
};

const chooseCity = () => t("onboarding.location.chooseCity");
const here = { name: RIYADH_NAME, distanceKm: DISTANCE_KM };
const unnamed = { name: null, distanceKm: DISTANCE_KM };
const distance = { distance: DISTANCE_KM };

const VIEW_ROWS: [string, ViewRow][] = [
  [
    "the offer, named",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      copy: () =>
        said(
          t("location.cityChange.greeting"),
          t("location.cityOffer.title", JEDDAH),
          t("location.cityOffer.body", SAVED)
        ),
      buttons: () => [t("location.cityOffer.use", JEDDAH), t("location.cityOffer.keep", SAVED)],
      offline: () => t("location.cityOffer.offline", JEDDAH),
    },
  ],
  [
    "the offer, named, with no saved name",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      savedUnnamed: true,
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      copy: () =>
        said(
          t("location.cityChange.greeting"),
          t("location.cityOffer.title", JEDDAH),
          t("location.cityOffer.bodyNoSavedName")
        ),
      buttons: () => [t("location.cityOffer.use", JEDDAH), t("location.cityOffer.keepSaved")],
      offline: () => t("location.cityOffer.offline", JEDDAH),
    },
  ],
  [
    "the offer, in the same city",
    {
      shape: OFFER_SHAPE.SAME_NAME,
      candidate: here,
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      copy: () =>
        said(
          t("location.cityChange.greeting"),
          t("location.cityOffer.sameName.title"),
          t("location.cityOffer.sameName.body", { ...distance, ...SAVED })
        ),
      buttons: () => [t("location.cityOffer.useHere"), t("location.cityOffer.keepSaved")],
      offline: () => t("location.cityOffer.offlineHere"),
    },
  ],
  [
    "the offer, unnamed",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      copy: () =>
        said(
          t("location.cityChange.greeting"),
          t("location.cityOffer.unnamed.title", { ...distance, ...SAVED }),
          t("location.cityOffer.body", SAVED)
        ),
      buttons: () => [
        t("location.cityOffer.useHere"),
        t("location.cityOffer.keep", SAVED),
        chooseCity(),
      ],
      offline: () => t("location.cityOffer.offlineHere"),
    },
  ],
  [
    "the offer, unnamed, with no saved name",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      savedUnnamed: true,
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      copy: () =>
        said(
          t("location.cityChange.greeting"),
          t("location.cityOffer.unnamed.titleNoSavedName", distance),
          t("location.cityOffer.bodyNoSavedName")
        ),
      buttons: () => [
        t("location.cityOffer.useHere"),
        t("location.cityOffer.keepSaved"),
        chooseCity(),
      ],
      offline: () => t("location.cityOffer.offlineHere"),
    },
  ],
  [
    "kept, named",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      stage: { kind: CITY_OFFER_STAGE.KEPT },
      copy: () =>
        said(
          t("location.cityOffer.kept.title", SAVED),
          t("location.cityOffer.kept.body", { ...SAVED, ...JEDDAH })
        ),
      buttons: () => [t("location.cityOffer.dontAsk", JEDDAH)],
    },
  ],
  [
    "kept, named, with no saved name",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      savedUnnamed: true,
      stage: { kind: CITY_OFFER_STAGE.KEPT },
      copy: () =>
        said(
          t("location.cityOffer.kept.titleHere"),
          t("location.cityOffer.kept.bodyNoSavedName", JEDDAH)
        ),
      buttons: () => [t("location.cityOffer.dontAsk", JEDDAH)],
    },
  ],
  [
    "kept, in the same city",
    {
      shape: OFFER_SHAPE.SAME_NAME,
      candidate: here,
      stage: { kind: CITY_OFFER_STAGE.KEPT },
      copy: () =>
        said(t("location.cityOffer.kept.titleHere"), t("location.cityOffer.kept.bodyHere", SAVED)),
      buttons: () => [t("location.cityOffer.dontAskHere")],
    },
  ],
  [
    "kept, unnamed",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      stage: { kind: CITY_OFFER_STAGE.KEPT },
      copy: () =>
        said(
          t("location.cityOffer.kept.title", SAVED),
          t("location.cityOffer.kept.bodyUnnamed", SAVED)
        ),
      buttons: () => [t("location.cityOffer.dontAskHere")],
    },
  ],
  [
    "kept, unnamed, with no saved name",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      savedUnnamed: true,
      stage: { kind: CITY_OFFER_STAGE.KEPT },
      copy: () => t("location.cityOffer.kept.titleHere"),
      buttons: () => [t("location.cityOffer.dontAskHere")],
    },
  ],
  [
    "muted, named",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      stage: { kind: CITY_OFFER_STAGE.MUTED },
      copy: () =>
        said(t("location.cityOffer.muted.title", JEDDAH), t("location.cityOffer.muted.body")),
      buttons: () => [],
    },
  ],
  [
    "muted, in the same city",
    {
      shape: OFFER_SHAPE.SAME_NAME,
      candidate: here,
      stage: { kind: CITY_OFFER_STAGE.MUTED },
      copy: () => said(t("location.cityOffer.muted.titleHere"), t("location.cityOffer.muted.body")),
      buttons: () => [],
    },
  ],
  [
    "muted, unnamed",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      stage: { kind: CITY_OFFER_STAGE.MUTED },
      copy: () => said(t("location.cityOffer.muted.titleHere"), t("location.cityOffer.muted.body")),
      buttons: () => [],
    },
  ],
  [
    "updated, to a named city",
    {
      shape: OFFER_SHAPE.NAMED,
      candidate: {},
      stage: { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true },
      landed: JEDDAH_PLACE,
      copy: () =>
        said(
          t("location.cityOffer.updated.title", JEDDAH),
          t("location.cityOffer.updated.body", JEDDAH)
        ),
      buttons: () => [],
    },
  ],
  [
    "updated, landed in the same city",
    {
      shape: OFFER_SHAPE.SAME_NAME,
      candidate: here,
      stage: { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true },
      landed: RIYADH_PLACE,
      copy: () =>
        said(
          t("location.cityOffer.updated.titleHere", SAVED),
          t("location.cityOffer.updated.bodyHere")
        ),
      buttons: () => [],
    },
  ],
  [
    "updated, landed in an unnamed place",
    {
      shape: OFFER_SHAPE.UNNAMED,
      candidate: unnamed,
      stage: { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true },
      landed: UNNAMED_LANDED,
      copy: () =>
        said(
          t("location.cityOffer.updated.titleUnnamed"),
          t("location.cityOffer.updated.bodyHere")
        ),
      buttons: () => [],
    },
  ],
];

describe("every view of the card, by the shape of the offer", () => {
  it("covers each shape in each view", () => {
    const shapes = Object.values(OFFER_SHAPE);
    const stages = [
      CITY_OFFER_STAGE.OFFER,
      CITY_OFFER_STAGE.KEPT,
      CITY_OFFER_STAGE.MUTED,
      CITY_OFFER_STAGE.UPDATED,
    ];
    stages.forEach((stage) =>
      shapes.forEach((shape) =>
        expect(VIEW_ROWS.some(([, row]) => row.stage.kind === stage && row.shape === shape)).toBe(
          true
        )
      )
    );
  });

  it.each(VIEW_ROWS)("says %s in full, with its actions", async (_name, row) => {
    if (row.savedUnnamed) unnamedSavedPlace();
    offerUp(candidateAt(row.candidate), row.stage);
    if (row.landed) {
      useLocationStore.getState().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
      writePlace(row.landed, { settled: true });
    }
    await renderOffer();

    expect(label()).toBe(row.copy());
    expect(
      screen.queryAllByRole("button").map((control) => control.props.accessibilityLabel)
    ).toEqual(row.buttons());
    if (!row.offline) return;
    await setOffline(true);
    expect(label()).toBe(said(row.copy(), row.offline()));
  });
});
