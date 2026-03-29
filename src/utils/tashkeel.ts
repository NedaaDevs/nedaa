const TASHKEEL_RE =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g;

export const stripTashkeel = (text: string): string => {
  return text.replace(TASHKEEL_RE, "");
};
