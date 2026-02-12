export const PRAYER_TIMES = {
  BASE: "/prayers",
  get GET_PRAYER_TIMES() {
    return `${this.BASE}`;
  },
  get PROVIDERS() {
    return `${this.BASE}/providers`;
  },
};

export const GEOCODE = {
  REVERSE: `/locations/reverse-geocode`,
};
