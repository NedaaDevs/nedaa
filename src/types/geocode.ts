export type ReverseGeocodeParams = {
  latitude: number;
  longitude: number;
  locale: string;
};

export type ReverseGeocodeResponse = {
  countryName: string;
  city: string;
  timezone: string;
};
