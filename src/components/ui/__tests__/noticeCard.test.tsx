import { Text } from "react-native";
import { screen } from "@testing-library/react-native";
import { MapPin } from "lucide-react-native";
import { getTokenValue } from "tamagui";

import config from "../../../../tamagui.config";
import { ICON_TILE_ID, ICON_TILE_TONE } from "@/components/ui/icon-tile";
import {
  NOTICE_CARD_PART,
  NOTICE_LINE,
  NoticeCard,
  type NoticeLine,
} from "@/components/ui/notice-card";
import { DEFAULT_FACES } from "@/constants/Fonts";
import i18n from "@/localization/i18n";
import { GLYPH_ID, Glyph } from "@/test-helpers/glyph";
import { fontSizeOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;
const TITLE = "You're in Jeddah";
const t = i18n.t.bind(i18n);

const BODY_LINE: NoticeLine = {
  text: "Prayer times are still for Riyadh.",
  kind: NOTICE_LINE.BODY,
};

const renderCard = (lines: readonly NoticeLine[], props: { live?: boolean } = {}) =>
  renderWithTheme(
    <NoticeCard icon={MapPin} tone={ICON_TILE_TONE.ACCENT} title={TITLE} lines={lines} {...props} />
  );

describe("NoticeCard", () => {
  it("reads the title and its lines as one element, the glyph hidden", async () => {
    await renderCard([BODY_LINE]);

    expect(
      screen.getByLabelText(t("a11y.join", { first: TITLE, second: BODY_LINE.text }))
    ).toBeTruthy();
    expect(screen.getByTestId(NOTICE_CARD_PART.GLYPH, { includeHiddenElements: true })).toHaveProp(
      "accessibilityElementsHidden",
      true
    );
  });

  it("shows an eyebrow above the title and reads it first", async () => {
    await renderWithTheme(
      <NoticeCard
        icon={MapPin}
        tone={ICON_TILE_TONE.ACCENT}
        eyebrow="Glad you arrived safely"
        title={TITLE}
        lines={[BODY_LINE]}
      />
    );

    expect(screen.getByText("Glad you arrived safely")).toBeTruthy();
    expect(screen.getByTestId(NOTICE_CARD_PART.TEXT)).toHaveProp(
      "accessibilityLabel",
      t("a11y.join", {
        first: t("a11y.join", { first: "Glad you arrived safely", second: TITLE }),
        second: BODY_LINE.text,
      })
    );
  });

  it("folds every line into the label, in order", async () => {
    const fact: NoticeLine = { text: "Asr is 1 hour earlier.", kind: NOTICE_LINE.FACT };
    await renderCard([BODY_LINE, fact]);

    const label = screen.getByTestId(NOTICE_CARD_PART.TEXT).props.accessibilityLabel;
    expect(label).toBe(
      t("a11y.join", {
        first: t("a11y.join", { first: TITLE, second: BODY_LINE.text }),
        second: fact.text,
      })
    );
  });

  it("sets a reason line last, muted, with its icon", async () => {
    await renderCard([
      BODY_LINE,
      { text: "You're offline.", kind: NOTICE_LINE.REASON, icon: Glyph },
    ]);

    expect(
      screen.getByTestId(NOTICE_CARD_PART.TEXT).props.accessibilityLabel.endsWith("You're offline.")
    ).toBe(true);
    expect(screen.getByText("You're offline.")).toHaveStyle({ color: LIGHT.muted.val });
    expect(screen.getByTestId(GLYPH_ID, { includeHiddenElements: true })).toHaveTextContent(
      LIGHT.muted.val
    );
  });

  it("sets a fact in the foreground and a body muted", async () => {
    await renderCard([BODY_LINE, { text: "Asr is 1 hour earlier.", kind: NOTICE_LINE.FACT }]);

    expect(screen.getByText(BODY_LINE.text)).toHaveStyle({ color: LIGHT.muted.val });
    expect(screen.getByText("Asr is 1 hour earlier.")).toHaveStyle({ color: LIGHT.fg.val });
  });

  it("sets the title at the large size, semibold", async () => {
    await renderCard([BODY_LINE]);

    expect(screen.getByText(TITLE)).toHaveStyle({
      fontSize: fontSizeOf("lg"),
      fontFamily: DEFAULT_FACES.semibold,
    });
  });

  it("sets every line at the helper size, medium", async () => {
    const fact: NoticeLine = { text: "Dubai is 1 hour ahead of Riyadh.", kind: NOTICE_LINE.FACT };
    await renderCard([BODY_LINE, fact]);

    [BODY_LINE.text, fact.text].forEach((text) =>
      expect(screen.getByText(text)).toHaveStyle({
        fontSize: fontSizeOf("helper"),
        fontFamily: DEFAULT_FACES.medium,
      })
    );
  });

  it("inks a fact's icon muted, its words in the foreground", async () => {
    const fact = "Dubai is 1 hour ahead of Riyadh.";
    await renderCard([{ text: fact, kind: NOTICE_LINE.FACT, icon: Glyph }]);

    expect(screen.getByText(fact)).toHaveStyle({ color: LIGHT.fg.val });
    expect(screen.getByTestId(GLYPH_ID, { includeHiddenElements: true })).toHaveTextContent(
      LIGHT.muted.val
    );
  });

  it("is a polite live region only when asked", async () => {
    await renderCard([BODY_LINE]);
    expect(screen.getByTestId(NOTICE_CARD_PART.TEXT)).not.toHaveProp(
      "accessibilityLiveRegion",
      "polite"
    );

    await renderCard([BODY_LINE], { live: true });
    expect(screen.getAllByTestId(NOTICE_CARD_PART.TEXT).at(-1)).toHaveProp(
      "accessibilityLiveRegion",
      "polite"
    );
  });

  it("rests on the card surface at the card radius, the glyph on the chip radius", async () => {
    await renderCard([BODY_LINE]);

    expect(screen.getByTestId(NOTICE_CARD_PART.FRAME)).toHaveStyle({
      borderTopLeftRadius: getTokenValue("$card", "radius"),
    });
    expect(screen.getByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toHaveStyle({
      borderTopLeftRadius: getTokenValue("$chip", "radius"),
    });
  });

  it("keeps its children out of the text element", async () => {
    await renderWithTheme(
      <NoticeCard icon={MapPin} tone={ICON_TILE_TONE.ACCENT} title={TITLE} lines={[BODY_LINE]}>
        <Text>child</Text>
      </NoticeCard>
    );

    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.getByTestId(NOTICE_CARD_PART.TEXT).props.accessibilityLabel).not.toContain(
      "child"
    );
  });
});
