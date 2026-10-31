import { isAlarmScreenPath } from "@/constants/Alarm";

const SCHEME_END = "://";

/** A custom-scheme link's route path: `app://alarm?x=1` is `/alarm`. */
export const linkPath = (url: string): string => {
  const rest = url.slice(url.indexOf(SCHEME_END) + SCHEME_END.length);
  const [path = ""] = rest.split(/[?#]/);
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
};

/** Whether a link opens one of the alarm screens. */
export const isAlarmLink = (url: string): boolean => isAlarmScreenPath(linkPath(url));
