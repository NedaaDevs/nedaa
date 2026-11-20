import { screen } from "@testing-library/react-native";

import { ReaderCount } from "@/components/athkar/session/ReaderCount";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import type { AthkarReader } from "@/hooks/useAthkarReader";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

const t = i18n.t.bind(i18n);
const sample = SAMPLE_SESSION.current!;
const HINT = t("athkar.session.audioCounts");

const reader: AthkarReader = {
  current: { ...sample, audioOwnsCount: true },
  count: sample.count,
  target: sample.target,
  fraction: 0,
  countText: `${sample.count}`,
  targetText: `${sample.target}`,
  figures: "",
  ratio: "",
  placeLine: "",
  counted: "",
  hint: HINT,
  said: null,
  add: jest.fn(),
};
const session: AthkarSession = { ...SAMPLE_SESSION, canUndo: true, undo: jest.fn() };

const flat = (node: { props: { style?: unknown } }) =>
  Object.assign({}, ...[node.props.style].flat(Infinity));

describe("ReaderCount", () => {
  it("lets a long hint wrap so undo keeps its place on the line", async () => {
    await renderWithTheme(<ReaderCount reader={reader} session={session} />);
    expect(flat(screen.getByText(HINT)).flexShrink).toBe(1);
    const undo = screen.getByRole("button", { name: t("athkar.session.undo") });
    expect(flat(undo).flexShrink).toBe(0);
  });
});
