import { DHIKR_TASK_ROWS } from "@/constants/DhikrTask";
import { ANSWER_CARD_POSITIONS } from "@/constants/WakeTaskBoards";
import { dhikrCardsOf, fullDhikr } from "@/utils/dhikrTask";

/** A row deals one card to each place on the board. */
const CARDS_PER_ROW = ANSWER_CARD_POSITIONS.length;

describe("DHIKR_TASK_ROWS", () => {
  it.each(DHIKR_TASK_ROWS.map((row, index) => [index, row] as const))(
    "row %i has a distinct card for each place, the answer among them",
    (_, row) => {
      const cards = dhikrCardsOf(row);
      expect(cards).toHaveLength(CARDS_PER_ROW);
      expect(new Set(cards).size).toBe(CARDS_PER_ROW);
      expect(cards).toContain(row.answer);
      cards.forEach((card) => expect(card.trim()).toBe(card));
      cards.forEach((card) => expect(card).not.toBe(""));
    }
  );

  it.each(DHIKR_TASK_ROWS.map((row, index) => [index, row] as const))(
    "row %i has words around its gap and a source",
    (_, row) => {
      expect(`${row.before}${row.after}`.trim()).not.toBe("");
      expect(fullDhikr(row)).toContain(row.answer);
      expect(Number.isInteger(row.sourceId) && row.sourceId > 0).toBe(true);
    }
  );
});
