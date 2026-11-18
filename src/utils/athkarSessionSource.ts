import type { Href } from "expo-router";

import {
  ATHKAR_FOCUS_HREF,
  FOCUS_PARAM,
  SESSION_SOURCE,
  type SessionSource,
} from "@/constants/AthkarSession";

export const DAILY_SOURCE: SessionSource = { kind: SESSION_SOURCE.DAILY };

const collectionHref = (kind: string, id: number): Href => ({
  pathname: ATHKAR_FOCUS_HREF,
  params: { [FOCUS_PARAM.SOURCE]: kind, [FOCUS_PARAM.ID]: id },
});

/** Where Focus opens on a source. */
export const focusHref = (source: SessionSource): Href => {
  switch (source.kind) {
    case SESSION_SOURCE.DAILY:
      return ATHKAR_FOCUS_HREF;
    case SESSION_SOURCE.HISN:
      return collectionHref(source.kind, source.categoryId);
    case SESSION_SOURCE.CUSTOM:
      return collectionHref(source.kind, source.groupId);
  }
};

type RouteParams = Readonly<Record<string, string | string[] | undefined>>;

const WHOLE_NUMBER = /^\d+$/;

/** The source Focus was opened on; params that name no collection are the daily session. */
export const parseSessionSource = (params: RouteParams): SessionSource => {
  const raw = params[FOCUS_PARAM.ID];
  if (typeof raw !== "string" || !WHOLE_NUMBER.test(raw)) return DAILY_SOURCE;
  const id = Number(raw);
  switch (params[FOCUS_PARAM.SOURCE]) {
    case SESSION_SOURCE.HISN:
      return { kind: SESSION_SOURCE.HISN, categoryId: id };
    case SESSION_SOURCE.CUSTOM:
      return { kind: SESSION_SOURCE.CUSTOM, groupId: id };
    default:
      return DAILY_SOURCE;
  }
};
