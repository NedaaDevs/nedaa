import { ATHKAR_TYPE, DEFAULT_ATHKAR_GROUP_ORDER } from "@/constants/Athkar";
import { DEFAULT_ATHKAR_DATA } from "@/constants/AthkarData";
import { SESSION_STATUS } from "@/constants/AthkarSession";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { positionMarks, textAt, toSessionItems } from "@/utils/athkarSession";

/** A third of the way through the first long count of the morning. */
const SAMPLE_SHARE = 1 / 3;

/** Does nothing: a sample has nothing to move. */
export const still = () => {};

const sampleSession = (): AthkarSession => {
  // The data holds two lengths of one dhikr at one place; the sample keeps the first.
  const morning = DEFAULT_ATHKAR_DATA.filter(({ type }) => type !== ATHKAR_TYPE.EVENING);
  const items = toSessionItems(
    morning
      .filter((dhikr, i) => morning.findIndex(({ order }) => order === dhikr.order) === i)
      .map((dhikr) => ({ ...dhikr, id: `${dhikr.order}` })),
    DEFAULT_ATHKAR_GROUP_ORDER
  );
  const longest = Math.max(...items.map(({ target }) => target));
  const index = items.findIndex(({ target }) => target === longest);
  const item = items[index];
  const count = Math.round(item.target * SAMPLE_SHARE);
  // Every dhikr before the place is finished.
  const counts = Object.fromEntries(
    items.slice(0, index + 1).map(({ id, target }, i) => [id, i === index ? count : target])
  );
  const after = items[index + 1];
  const shown = textAt(item, counts);
  return {
    status: SESSION_STATUS.READY,
    items,
    counts,
    index,
    current: {
      item,
      textId: shown.id,
      text: shown.text,
      count,
      target: item.target,
      done: false,
      audioOwnsCount: false,
    },
    next: after ? { text: textAt(after, counts).text } : null,
    marks: positionMarks(items, counts, index),
    canUndo: true,
    advancePending: false,
    canStep: { previous: index > 0, next: after !== undefined },
    add: still,
    addMany: still,
    undo: still,
    jumpTo: still,
    step: still,
  };
};

/** A session that never moves, for a look shown as a picture. */
export const SAMPLE_SESSION = sampleSession();
