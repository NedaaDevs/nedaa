import { AccessibilityInfo, Platform } from "react-native";

import { holdForAnnouncement } from "@/components/alarm/challenges/holdForAnnouncement";
import { ANNOUNCEMENT_FINISHED } from "@/constants/Accessibility";
import { DHIKR_HOLD_MS, SPOKEN_MS_PER_CHARACTER } from "@/constants/WakeTaskBoards";
import { PlatformType } from "@/enums/app";

type Finished = (event: { announcement: string; success: boolean }) => void;

const MESSAGE = "a line the reader says";
/** Long enough that saying it outlasts the minimum hold. */
const LONG_MESSAGE = "x".repeat(
  Math.ceil(DHIKR_HOLD_MS.SCREEN_READER / SPOKEN_MS_PER_CHARACTER) * 2
);

/** Captures the end-of-speech listener the hold adds, and its removal. */
const listen = () => {
  const remove = jest.fn();
  const listeners: Finished[] = [];
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    event: string,
    handler: Finished
  ) => {
    if (event === ANNOUNCEMENT_FINISHED) listeners.push(handler);
    return { remove } as never;
  }) as never);
  const finish = (announcement: string) =>
    listeners.forEach((handler) => handler({ announcement, success: true }));
  return { remove, finish };
};

describe("holdForAnnouncement", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("on iOS", () => {
    beforeEach(() => jest.replaceProperty(Platform, "OS", PlatformType.IOS));

    it("does not end at the minimum while the announcement is still being said", () => {
      listen();
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      jest.advanceTimersByTime(DHIKR_HOLD_MS.SCREEN_READER);

      expect(onEnd).not.toHaveBeenCalled();
    });

    it("ends once the announcement is said and the minimum has passed", () => {
      const { finish, remove } = listen();
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      jest.advanceTimersByTime(DHIKR_HOLD_MS.SCREEN_READER);
      finish(MESSAGE);

      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalled();
    });

    it("waits out the minimum when the announcement ends first", () => {
      const { finish } = listen();
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      finish(MESSAGE);
      jest.advanceTimersByTime(DHIKR_HOLD_MS.SCREEN_READER - 1);
      expect(onEnd).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("ignores the end of any other announcement", () => {
      const { finish } = listen();
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      jest.advanceTimersByTime(DHIKR_HOLD_MS.SCREEN_READER);
      finish(`${MESSAGE} and more`);

      expect(onEnd).not.toHaveBeenCalled();
    });

    it("ends at the ceiling when no end of speech arrives", () => {
      listen();
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      jest.advanceTimersByTime(DHIKR_HOLD_MS.CEILING - 1);
      expect(onEnd).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("stops listening and never ends once cancelled", () => {
      const { finish, remove } = listen();
      const onEnd = jest.fn();
      const cancel = holdForAnnouncement(MESSAGE, onEnd);

      cancel();
      finish(MESSAGE);
      jest.advanceTimersByTime(DHIKR_HOLD_MS.CEILING);

      expect(remove).toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
    });
  });

  describe("on Android", () => {
    beforeEach(() => jest.replaceProperty(Platform, "OS", PlatformType.ANDROID));

    it("holds a short announcement for the minimum", () => {
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd);

      jest.advanceTimersByTime(DHIKR_HOLD_MS.SCREEN_READER - 1);
      expect(onEnd).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("holds a long announcement for the time its length takes to say", () => {
      const spoken = LONG_MESSAGE.length * SPOKEN_MS_PER_CHARACTER;
      const onEnd = jest.fn();
      holdForAnnouncement(LONG_MESSAGE, onEnd);

      jest.advanceTimersByTime(spoken - 1);
      expect(onEnd).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("never ends once cancelled", () => {
      const onEnd = jest.fn();
      holdForAnnouncement(MESSAGE, onEnd)();

      jest.advanceTimersByTime(DHIKR_HOLD_MS.CEILING);

      expect(onEnd).not.toHaveBeenCalled();
    });
  });
});
