import { useEffect, useState } from "react";
import { useWindowDimensions, type AccessibilityActionEvent } from "react-native";
import { useTranslation } from "react-i18next";

import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { signedCount } from "@/components/athkar/session/FocusHint";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { FOCUS_ACTION, FOCUS_TIMING, STEP, type StepDirection } from "@/constants/AthkarFocus";
import { useRTL } from "@/contexts/RTLContext";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { useChangeOnly } from "@/hooks/useChangeOnly";
import { useFocusGesture, type FocusGesture } from "@/hooks/useFocusGesture";
import { useCountText, useRatioText } from "@/hooks/useRatioText";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAthkarStore } from "@/stores/athkar";
import { splitAthkarText } from "@/utils/athkarText";
import { holdAmount } from "@/utils/focusGesture";

type Zone = { top: number; bottom: number };

/** True for `ms` after each change of `token`; false until the first one. */
const useShownAfterChange = (token: number, ms: number): boolean => {
  const [state, setState] = useState({ token, shown: false });
  if (state.token !== token) setState({ token, shown: true });
  useEffect(() => {
    if (!state.shown) return;
    const timer = setTimeout(() => setState((now) => ({ ...now, shown: false })), ms);
    return () => clearTimeout(timer);
  }, [state, ms]);
  return state.shown;
};

/** One Focus stage's state and rules, for a look to draw. */
export type FocusStage = {
  session: AthkarSession;
  current: NonNullable<AthkarSession["current"]>;
  /** The current dhikr's place in the session. */
  place: number;
  count: number;
  target: number;
  canUndo: boolean;
  gesture: FocusGesture;
  width: number;
  isRTL: boolean;
  reduceMotion: boolean;
  /** The first-visit hint is drawn, until the first touch. */
  hintVisible: boolean;
  hinting: boolean;
  /** Taps counted so far; each one landed at the gesture's point. */
  taps: number;
  /** The session position shows: after a move, and at an edge. */
  placeVisible: boolean;
  /** The place as drawn, such as "3 / 18". */
  figures: string;
  countText: string;
  targetText: string;
  /** The line under the number, such as "of 33". */
  targetLine: string;
  /** What a release would add or take, such as "+10"; null draws none. */
  change: string | null;
  /** The line that replaces the hint; null draws none. */
  statusLine: string | null;
  /** Each measured text is taller than its space, by text key. */
  tall: Readonly<Record<string, boolean>>;
  onTall: (textKey: string, tall: boolean) => void;
  /** Where the text sits, in the surface's y. */
  onTextZone: (zone: Zone) => void;
  /** The surface as a screen reader meets it. */
  label: string;
  hint: string | undefined;
  actions: { name: string; label?: string }[];
  act: (event: AccessibilityActionEvent) => void;
  /** Lines to speak as they change. */
  spoken: { change: string | null; edge: string | null };
};

type Options = Pick<AthkarFocusProps, "session" | "hintSeen" | "onHintSeen" | "onStep">;

/** The place and count last drawn, and what was said for them. */
type Said = { place: number; count: number; line: string | null };

/** The Focus stage every look draws: one touch surface, one dhikr, its count. */
export const useFocusStage = ({
  session,
  hintSeen,
  onHintSeen,
  onStep,
}: Options): FocusStage | null => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const countText = useCountText();
  const ratioText = useRatioText();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);

  const { current, index, items } = session;
  const place = index ?? 0;
  const count = current?.count ?? 0;
  const target = current?.target ?? 0;
  // Audio that owns the count closes the tap, the hold and the undo.
  const locked = current?.audioOwnsCount ?? false;
  const canTap = !locked;
  const canUndo = !locked && session.canUndo;
  const room = locked ? 0 : holdAmount(count, target);

  // The hint is drawn on a first visit only, and goes at the first touch.
  const [hinting] = useState(!hintSeen);
  const [touched, setTouched] = useState(false);
  const [taps, setTaps] = useState(0);
  const [edgeTry, setEdgeTry] = useState<{ by: StepDirection; place: number } | null>(null);
  // The line belongs to the place it was tried on, and goes with it.
  if (edgeTry && edgeTry.place !== place) setEdgeTry(null);
  const edge = edgeTry?.place === place ? edgeTry : null;
  const [tall, setTall] = useState<Readonly<Record<string, boolean>>>({});
  const [textZone, setTextZone] = useState<Zone | null>(null);
  const placeShown = useShownAfterChange(place, FOCUS_TIMING.POSITION_MS);

  useEffect(() => {
    if (!edgeTry) return;
    const timer = setTimeout(() => setEdgeTry(null), FOCUS_TIMING.EDGE_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [edgeTry]);

  const touch = () => {
    if (touched) return;
    setTouched(true);
    if (hinting) onHintSeen();
  };

  // Text not yet measured holds its zone: a drag down there is no undo.
  const fits = current ? tall[current.textKey] === false : true;
  const gesture = useFocusGesture({
    index: place,
    width,
    rtl: isRTL,
    reduceMotion,
    canPrevious: session.canStep.previous,
    canNext: session.canStep.next,
    canTap,
    canUndo,
    holdRoom: room,
    scrollZone: fits ? null : textZone,
    onTouch: touch,
    onTap: () => {
      setTaps((n) => n + 1);
      session.add();
    },
    onStep,
    // A new object each time, so a second try restarts the line's time.
    onEdge: (by) => setEdgeTry({ by, place }),
    onUndo: session.undo,
    onHold: session.addMany,
  });

  const placeLine = t("athkar.audio.thikrProgress", {
    current: countText(place + 1),
    total: countText(items.length),
  });
  const counted = t("a11y.athkar.cardProgress", {
    current: countText(count),
    total: countText(target),
  });
  const audioCounts = t("athkar.session.audioCounts");
  const edgeLine =
    edge === null
      ? null
      : t(edge.by === STEP.NEXT ? "athkar.session.lastThikr" : "athkar.focus.firstThikr");
  // A new place says where it is; a count by hand says the count.
  const arrival = count === 0 ? placeLine : t("a11y.join", { first: placeLine, second: counted });
  const [said, setSaid] = useState<Said>({ place, count, line: arrival });
  if (said.place !== place) setSaid({ place, count, line: arrival });
  // A count the audio makes stays unsaid; the recitation is playing.
  else if (said.count !== count) setSaid({ place, count, line: locked ? null : counted });
  const changed = useChangeOnly(said.line);

  if (!current) return null;

  const statusLine =
    edgeLine ?? (locked ? audioCounts : current.done ? t("athkar.session.thikrDone") : null);
  const change = gesture.holding
    ? signedCount("+", countText(room))
    : gesture.undoArmed
      ? signedCount("−", countText(1))
      : null;

  // The label says what the text draws: the Arabic, then a shown translation.
  const { arabic, translation } = splitAthkarText(t(current.textKey), i18n.language);
  const label = [
    arabic,
    ...(showTranslation && translation ? [translation] : []),
    counted,
    ...(locked ? [audioCounts] : []),
  ].reduce((first, second) => t("a11y.join", { first, second }));
  const actions = [
    ...(canTap ? [{ name: A11Y_ACTION.ACTIVATE }] : []),
    // One repeat left is what activating adds.
    ...(room > 1
      ? [{ name: FOCUS_ACTION.ADD_MANY, label: t("a11y.athkar.focus.addMany", { count: room }) }]
      : []),
    ...(canUndo ? [{ name: FOCUS_ACTION.UNDO, label: t("athkar.session.undo") }] : []),
    ...(session.canStep.next
      ? [{ name: FOCUS_ACTION.NEXT, label: t("a11y.athkar.focus.nextThikr") }]
      : []),
    ...(session.canStep.previous
      ? [{ name: FOCUS_ACTION.PREVIOUS, label: t("a11y.athkar.focus.previousThikr") }]
      : []),
  ];
  const act = ({ nativeEvent: { actionName } }: AccessibilityActionEvent) => {
    // An action can arrive after audio took the count and its entry went.
    if (actionName === A11Y_ACTION.ACTIVATE) {
      if (canTap) session.add();
    } else if (actionName === FOCUS_ACTION.ADD_MANY) {
      if (room > 0) session.addMany(room);
    } else if (actionName === FOCUS_ACTION.UNDO) {
      if (canUndo) session.undo();
    } else if (actionName === FOCUS_ACTION.NEXT) onStep(STEP.NEXT);
    else if (actionName === FOCUS_ACTION.PREVIOUS) onStep(STEP.PREVIOUS);
  };

  return {
    session,
    current,
    place,
    count,
    target,
    canUndo,
    gesture,
    width,
    isRTL,
    reduceMotion,
    hinting,
    hintVisible: !touched,
    taps,
    placeVisible: placeShown || edge !== null,
    figures: ratioText(place + 1, items.length),
    countText: countText(count),
    targetText: countText(target),
    targetLine: t("athkar.focus.ofTarget", { target: countText(target) }),
    change,
    statusLine,
    tall,
    onTall: (textKey, isTall) =>
      setTall((now) => (now[textKey] === isTall ? now : { ...now, [textKey]: isTall })),
    onTextZone: setTextZone,
    label,
    hint: canTap && !current.done ? t("athkar.focus.tapToIncrement") : undefined,
    actions,
    act,
    spoken: { change: changed, edge: edgeLine },
  };
};
