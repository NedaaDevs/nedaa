import { ATHKAR_FOCUS_HREF, FOCUS_PARAM, SESSION_SOURCE } from "@/constants/AthkarSession";
import type { SessionSource } from "@/constants/AthkarSession";
import { focusHref, parseSessionSource } from "@/utils/athkarSessionSource";

const DAILY: SessionSource = { kind: SESSION_SOURCE.DAILY };
const HISN: SessionSource = { kind: SESSION_SOURCE.HISN, categoryId: 12 };
const CUSTOM: SessionSource = { kind: SESSION_SOURCE.CUSTOM, groupId: 3 };

/** The params a route reads back from an href. */
const paramsOf = (source: SessionSource): Record<string, string> => {
  const href = focusHref(source);
  if (typeof href === "string") return {};
  return Object.fromEntries(
    Object.entries(href.params ?? {}).map(([key, value]) => [key, String(value)])
  );
};

describe("the Focus route's source", () => {
  test("the daily session is the bare path", () => {
    expect(focusHref(DAILY)).toBe(ATHKAR_FOCUS_HREF);
  });

  test.each([DAILY, HISN, CUSTOM])("an href reads back as its source: %o", (source) => {
    expect(parseSessionSource(paramsOf(source))).toEqual(source);
  });

  test.each([
    {},
    { [FOCUS_PARAM.SOURCE]: SESSION_SOURCE.HISN },
    { [FOCUS_PARAM.SOURCE]: SESSION_SOURCE.HISN, [FOCUS_PARAM.ID]: "abc" },
    { [FOCUS_PARAM.SOURCE]: SESSION_SOURCE.HISN, [FOCUS_PARAM.ID]: "1.5" },
    { [FOCUS_PARAM.SOURCE]: SESSION_SOURCE.CUSTOM, [FOCUS_PARAM.ID]: "-2" },
    { [FOCUS_PARAM.SOURCE]: SESSION_SOURCE.CUSTOM, [FOCUS_PARAM.ID]: ["3", "4"] },
    { [FOCUS_PARAM.SOURCE]: "elsewhere", [FOCUS_PARAM.ID]: "3" },
    { [FOCUS_PARAM.ID]: "3" },
  ])("params that name no collection open the daily session: %o", (params) => {
    expect(parseSessionSource(params)).toEqual(DAILY);
  });
});
