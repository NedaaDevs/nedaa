export const PRAYER_TIMES = {
  BASE: "/prayer-times",
  get GET_PRAYER_TIMES() {
    return `${this.BASE}`;
  },
  get PROVIDERS() {
    return `${this.BASE}/providers`;
  },
};
