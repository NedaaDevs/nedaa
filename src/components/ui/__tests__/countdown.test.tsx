import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { withSpring, withTiming } from "react-native-reanimated";

import {
  COUNT_DIRECTION,
  COUNTDOWN,
  COUNTDOWN_PART,
  Countdown,
  Rolling,
  reelStep,
} from "@/components/ui/countdown";
import { SPIN } from "@/constants/Countdown";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const hidden = { includeHiddenElements: true };
const part = (id: string) => screen.queryAllByTestId(id, hidden);
const LINE = 20;
const DIGITS = "0123456789";

/** Lays each slot out one line high, as the device would. */
const layOut = async () => {
  for (const shape of part(COUNTDOWN_PART.SHAPE)) {
    await act(() =>
      fireEvent(shape, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 10, height: LINE } },
      })
    );
  }
};

/** The digits the reels show, read from where each strip stands. */
const shown = () => {
  const [row] = part(COUNTDOWN_PART.ROW);
  return within(row)
    .getAllByTestId(COUNTDOWN_PART.REEL, hidden)
    .map((reel) => {
      const { transform } = Object.assign({}, ...[reel.props.style].flat());
      const line = Math.round(-transform[0].translateY / LINE);
      return DIGITS[line % 10];
    })
    .join("");
};

const figure = (value: string, extra = {}) => (
  <Countdown
    value={value}
    reserve="00:00"
    counting={COUNT_DIRECTION.DOWN}
    openKey={0}
    switchKey="until"
    {...extra}
  />
);

describe("reelStep", () => {
  it.each([
    [0, 9, COUNT_DIRECTION.DOWN, -1],
    [5, 4, COUNT_DIRECTION.DOWN, -1],
    [0, 9, COUNT_DIRECTION.UP, 9],
    [4, 5, COUNT_DIRECTION.UP, 1],
    [3, 3, COUNT_DIRECTION.UP, 0],
  ])("from %i to %i counting %s takes %i steps", (from, to, direction, steps) => {
    expect(reelStep(from, to, direction)).toBe(steps);
  });
});

describe("Countdown", () => {
  beforeEach(() => {
    mockReduced = false;
    jest.clearAllMocks();
  });

  // Digits read left to right in every language; RTL would turn 1:18 into 81:1.
  it("keeps its digits left to right in RTL", async () => {
    await renderWithTheme(figure("1:18"), { isRTL: true });

    expect(part(COUNTDOWN_PART.ROW)[0]).toHaveStyle({ direction: "ltr" });
  });

  it("sets its digits in tabular figures", async () => {
    await renderWithTheme(figure("1:18"));

    for (const eight of screen.getAllByText("8", hidden)) {
      expect(eight).toHaveStyle({ fontVariant: ["tabular-nums"] });
    }
  });

  // Arabic-Indic digits are not tabular in the Arabic font: ٤ is wider than ٥.
  it.each([
    ["Latin", "1:18", "0123456789"],
    ["Arabic-Indic", "١:١٨", "٠١٢٣٤٥٦٧٨٩"],
    ["Eastern Arabic-Indic", "۱:۱۸", "۰۱۲۳۴۵۶۷۸۹"],
  ])("sizes each %s digit to the widest digit of its script", async (_, value, set) => {
    await renderWithTheme(figure(value, { reserve: value }));

    const sizers = part(COUNTDOWN_PART.SIZER).map((node) =>
      within(node)
        .getAllByText(/./, hidden)
        .map((text) => text.props.children)
        .join("")
    );
    expect(sizers.length).toBeGreaterThan(0);
    sizers.forEach((digits) => expect(digits).toBe(set));
  });

  // Three turns of digits let a reel pass 9 to 0 with no visible seam.
  it("runs each digit on a reel of three turns of its script", async () => {
    await renderWithTheme(figure("١:١٨"));

    const [reel] = part(COUNTDOWN_PART.REEL);
    expect(
      within(reel)
        .getAllByText(/./, hidden)
        .map((t) => t.props.children)
        .join("")
    ).toBe("٠١٢٣٤٥٦٧٨٩".repeat(3));
  });

  it("whirls each reel to its digit when first shown", async () => {
    await renderWithTheme(figure("1:18"));
    await layOut();

    expect(shown()).toBe("118");
    expect(withTiming).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ duration: SPIN.ms })
    );
  });

  // A tick glides, calm and evenly paced; only a whirl bounces.
  it("glides only the reel that changed on a tick", async () => {
    const { rerender } = await renderWithTheme(figure("1:18"));
    await layOut();
    jest.clearAllMocks();

    await rerender(figure("1:17"));

    expect(shown()).toBe("117");
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ duration: COUNTDOWN.tickMs })
    );
    expect(withSpring).not.toHaveBeenCalled();
  });

  it("whirls again from where it stands on a switch", async () => {
    const { rerender } = await renderWithTheme(figure("1:18"));
    await layOut();
    jest.clearAllMocks();

    await rerender(figure("2:10", { switchKey: "since", counting: COUNT_DIRECTION.UP }));

    expect(shown()).toBe("210");
    expect(withTiming).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ duration: SPIN.ms })
    );
  });

  it("stands each reel at its digit, unanimated, under reduced motion", async () => {
    mockReduced = true;
    const { rerender } = await renderWithTheme(figure("1:18"));
    await layOut();
    await rerender(figure("1:17"));

    expect(shown()).toBe("117");
    expect(withTiming).not.toHaveBeenCalled();
    expect(withSpring).not.toHaveBeenCalled();
  });
});

describe("Rolling", () => {
  beforeEach(() => {
    mockReduced = false;
  });

  it("rolls a whole label in as one piece", async () => {
    const { rerender } = await renderWithTheme(<Rolling value="until Asr" />);
    const before = part(COUNTDOWN_PART.GLYPH);

    await rerender(<Rolling value="since Dhuhr" />);

    expect(part(COUNTDOWN_PART.GLYPH)).toHaveLength(1);
    expect(part(COUNTDOWN_PART.GLYPH)[0]).not.toBe(before[0]);
    expect(part(COUNTDOWN_PART.GLYPH)[0].props.entering).toBeDefined();
  });
});
